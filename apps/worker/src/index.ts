// Background worker: everything that must not block a guest's request.
// Web and admin add the jobs; this runs them.

import {
  JOB,
  QUEUE,
  VILLA_TZ,
  beds24Mode,
  createRedis,
  expireHolds,
  overbooked,
  pollBookings,
  pullBooking,
  pushAri,
  pushBooking,
  queue,
  type AriInput,
  type ImportResult,
} from '@vyona/core';
import { prisma } from '@vyona/db';
import { Worker, type Job } from 'bullmq';
import { sendGuestCancellation, sendGuestConfirmation, sendOwnerBooking, sendOwnerConflict, sendOwnerRefund } from './mail';

type Data = { reservationId: string; orderId: string; bookingId: number } & AriInput;

/** Tells the owner about an overbooking; an import that changed nothing has already been reported. */
async function report(r: ImportResult) {
  if (!r.reservation || r.outcome === 'unchanged' || r.outcome === 'ours') return;
  if (r.conflicts.length || r.closed.length) {
    await overbooked(r.reservation.id, `${r.reservation.roomId}-${r.reservation.checkIn.toISOString().slice(0, 10)}`);
  }
}

const describe = (r: ImportResult) =>
  `${r.outcome}${r.reservation ? ` ${r.reservation.ref}` : ''}${r.conflicts.length ? `, overbooked with ${r.conflicts.join(', ')}` : ''}${
    r.closed.length ? `, on closed nights` : ''
  }${r.bumped.length ? `, took the nights of hold ${r.bumped.join(', ')}` : ''}`;

const handlers: Record<string, (data: Data) => Promise<unknown>> = {
  [JOB.expireHolds]: async () => {
    const n = await expireHolds();
    return n ? `expired ${n} hold${n === 1 ? '' : 's'}` : 'nothing to expire';
  },
  [JOB.guestConfirmation]: (d) => sendGuestConfirmation(d.reservationId),
  [JOB.guestCancellation]: (d) => sendGuestCancellation(d.reservationId),
  [JOB.ownerBooking]: (d) => sendOwnerBooking(d.reservationId),
  [JOB.ownerRefund]: (d) => sendOwnerRefund(d.reservationId, d.orderId),
  [JOB.ownerConflict]: (d) => sendOwnerConflict(d.reservationId),

  // Both look at the booking's current status, so a cancel that overtakes a
  // create (or the other way round) still ends in the right state.
  [JOB.beds24Booking]: (d) => pushBooking(d.reservationId),
  [JOB.beds24Cancel]: (d) => pushBooking(d.reservationId),
  [JOB.beds24Ari]: (d) => pushAri({ roomIds: d.roomIds, from: d.from, until: d.until }),
  [JOB.beds24Pull]: async (d) => {
    const r = await pullBooking(Number(d.bookingId));
    if (typeof r === 'string') return r === 'off' ? 'skipped: Booking.com sync is off' : `Beds24 has no booking ${d.bookingId}`;
    await report(r);
    return describe(r);
  },
  [JOB.beds24Poll]: async () => {
    const r = await pollBookings();
    if (r === 'off') return 'skipped: Booking.com sync is off';
    for (const i of r.imported) await report(i);
    const changed = r.imported.filter((i) => i.outcome !== 'unchanged' && i.outcome !== 'ours' && i.outcome !== 'ignored');
    if (r.errors.length) throw new Error(`poll: ${r.errors.join('; ')}`);
    return changed.length || r.pushed ? `${changed.map(describe).join('; ') || 'no bookings changed'}; pushed ${r.pushed}` : 'nothing new';
  },
};

/** Jobs that run on a timer only log when they did something. */
const QUIET: Record<string, string> = { [JOB.expireHolds]: 'nothing to expire', [JOB.beds24Poll]: 'nothing new' };

async function handle(job: Job<Data>) {
  const run = handlers[job.name];
  if (!run) {
    console.log(`[${job.queueName}] ${job.name} #${job.id} — no handler yet`, job.data);
    return;
  }
  const result = await run(job.data);
  if (QUIET[job.name] !== result) console.log(`[${job.queueName}] ${job.name} #${job.id}: ${result}`);
  return result;
}

// Sync jobs run one at a time: a push and an import of the same booking never
// overlap, and Beds24's five-minute credit limit is easier to stay under.
const workers = Object.values(QUEUE).map(
  (name) =>
    new Worker(name, handle, { connection: createRedis(), concurrency: name === QUEUE.sync ? 1 : 4 })
      .on('failed', (job, err) => console.error(`[${name}] ${job?.name} #${job?.id} failed:`, err.message))
      .on('error', (err) => console.error(`[${name}]`, err.message)),
);

// Holds also stop counting the moment their deadline passes (every query checks
// holdUntil); the sweep just tidies their status and frees the RoomDay rows.
await queue(QUEUE.ops).upsertJobScheduler(
  JOB.expireHolds,
  { every: 60_000 },
  { name: JOB.expireHolds, opts: { removeOnComplete: true, removeOnFail: 100 } },
);

const mode = beds24Mode();
if (mode === 'off') {
  await queue(QUEUE.sync).removeJobScheduler(JOB.beds24Poll);
  await queue(QUEUE.sync).removeJobScheduler(JOB.beds24Ari);
} else {
  // FR-10: catch whatever a webhook missed.
  await queue(QUEUE.sync).upsertJobScheduler(
    JOB.beds24Poll,
    { every: 10 * 60_000 },
    { name: JOB.beds24Poll, opts: { removeOnComplete: true, removeOnFail: 100 } },
  );
  // The whole year again each night: the horizon moves a day, and anything a
  // failed push left behind is put right.
  await queue(QUEUE.sync).upsertJobScheduler(
    JOB.beds24Ari,
    { pattern: '30 3 * * *', tz: VILLA_TZ },
    { name: JOB.beds24Ari, data: {}, opts: { removeOnComplete: 50, removeOnFail: 100 } },
  );
}

await prisma.$queryRaw`SELECT 1`;
console.log(`✓ worker up: queues ${Object.values(QUEUE).join(', ')}; Booking.com sync: ${mode}`);

async function shutdown(signal: string) {
  console.log(`${signal}: closing workers`);
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(Object.values(QUEUE).map((name) => queue(name).close()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
