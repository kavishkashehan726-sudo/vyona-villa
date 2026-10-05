// BullMQ queue and job names shared by the apps that enqueue (web, admin) and
// the worker that processes them.

import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';

export const QUEUE = {
  /** Beds24: ARI pushes, booking create/cancel, fallback poll. */
  sync: 'sync',
  /** Housekeeping: expire holds, send emails. */
  ops: 'ops',
} as const;

export const JOB = {
  /** ops, every minute: frees the nights of holds nobody paid for. */
  expireHolds: 'expire-holds',
  /** ops: { reservationId } → the guest's confirmation email. */
  guestConfirmation: 'email-guest-confirmation',
  /** ops: { reservationId } → "new booking" to ADMIN_EMAIL. */
  ownerBooking: 'email-owner-booking',
  /** ops: { reservationId, orderId } → a paid booking that could not be confirmed. */
  ownerRefund: 'email-owner-refund',
  /** ops: { reservationId } → tells the guest the owner cancelled their booking. */
  guestCancellation: 'email-guest-cancellation',
  /** sync: { reservationId } → create or update the booking in Beds24 (step 6). */
  beds24Booking: 'beds24-booking',
  /** sync: { reservationId } → cancel the booking in Beds24 (step 6). */
  beds24Cancel: 'beds24-cancel',
  /** sync: { roomIds?, from?, until? } → push prices and availability; no fields = everything (step 6). */
  beds24Ari: 'beds24-ari',
} as const;

// BullMQ 6 treats ioredis as optional and, under native ESM, wants a client
// instance rather than connection options. Workers need their own connection
// because they issue blocking commands; queues can share one.
export function createRedis() {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
}

// Parked on globalThis for the same reason as the Prisma client: Next.js dev
// reloads modules and would open a new connection each time.
const g = globalThis as unknown as { __vyonaQueues?: Map<string, Queue> };
const queues = (g.__vyonaQueues ??= new Map());
let shared: Redis | undefined;

export function queue(name: (typeof QUEUE)[keyof typeof QUEUE]): Queue {
  let q = queues.get(name);
  if (!q) {
    shared ??= createRedis();
    q = new Queue(name, { connection: shared });
    queues.set(name, q);
  }
  return q;
}

// Completed jobs are kept a week so a repeated jobId (a retried notify) is
// recognised and not sent twice.
const once = (jobId: string): JobsOptions => ({
  jobId,
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
  removeOnComplete: { age: 7 * 24 * 3600 },
  removeOnFail: { age: 30 * 24 * 3600 },
});

/** Everything that follows a confirmed booking. Safe to call twice. */
export async function afterConfirm(reservationId: string) {
  await Promise.all([
    queue(QUEUE.ops).add(JOB.guestConfirmation, { reservationId }, once(`guest-${reservationId}`)),
    queue(QUEUE.ops).add(JOB.ownerBooking, { reservationId }, once(`owner-${reservationId}`)),
    queue(QUEUE.sync).add(JOB.beds24Booking, { reservationId }, { ...once(`b24-${reservationId}`), attempts: 3 }),
  ]);
}

/** Tells the owner a guest paid for nights that were no longer free. */
export async function needsRefund(reservationId: string, orderId: string) {
  await queue(QUEUE.ops).add(JOB.ownerRefund, { reservationId, orderId }, once(`refund-${orderId}`));
}

/* ------------------------------------------------------------- the owner */

const sync = { attempts: 3, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 500, removeOnFail: 500 } as const;

/** A booking the owner entered by hand: close the nights on Booking.com, and email the guest if asked. */
export async function afterManualBooking(reservationId: string, emailGuest: boolean) {
  await Promise.all([
    queue(QUEUE.sync).add(JOB.beds24Booking, { reservationId }, once(`b24-${reservationId}`)),
    emailGuest && queue(QUEUE.ops).add(JOB.guestConfirmation, { reservationId }, once(`guest-${reservationId}`)),
  ]);
}

/** The owner moved a booking to other dates or another room. */
export async function afterMove(reservationId: string) {
  await queue(QUEUE.sync).add(JOB.beds24Booking, { reservationId }, sync);
}

/** The owner cancelled a booking: reopen its nights on Booking.com and tell the guest if asked. */
export async function afterCancel(reservationId: string, emailGuest: boolean) {
  await Promise.all([
    queue(QUEUE.sync).add(JOB.beds24Cancel, { reservationId }, { ...once(`b24-cancel-${reservationId}`), attempts: 3 }),
    emailGuest && queue(QUEUE.ops).add(JOB.guestCancellation, { reservationId }, once(`cancel-${reservationId}`)),
  ]);
}

/** Prices or availability changed: blocks, overrides, rates or settings. Omit the range for everything. */
export async function afterRatesChange(range?: { roomIds: string[]; from: string; until: string }) {
  await queue(QUEUE.sync).add(JOB.beds24Ari, range ?? {}, sync);
}
