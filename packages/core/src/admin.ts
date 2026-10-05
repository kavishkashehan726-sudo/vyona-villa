// What the owner does in the admin: the room × date chart, closing and pricing
// nights, and bookings entered, moved or cancelled by hand. Anything that
// changes who occupies a night locks it first, through lockNights, so these
// can run while guests are booking.

import { prisma, type Prisma, type Reservation, type ReservationSource, type ReservationStatus } from '@vyona/db';
import { newRef } from './booking';
import { dayOf, nightsOf, parseDay, toDate, today } from './dates';
import { expireStale, lockNights, reclaimNights, type LockedNight } from './nights';
import { nightlyRate, quote, type Quote, type PricingSettings, type Rule } from './pricing';
import { loadRules, loadSettings } from './settings';

type Tx = Prisma.TransactionClient;

export type AdminErrorCode = 'NOT_FOUND' | 'INVALID' | 'UNAVAILABLE' | 'NOT_EDITABLE';

/** A change the owner asked for that can't be made; the message says why, in words for the owner. */
export class AdminError extends Error {
  constructor(
    readonly code: AdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AdminError';
  }
}

export const MAX_RANGE_DAYS = 366;
export const MAX_ADMIN_NIGHTS = 90;
export const MAX_PRICE = 10_000_00;

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const shortDate = (day: number) => dayFmt.format(toDate(day));

/* ------------------------------------------------------------------ chart */

export type GridNight = {
  /** Cents: the owner's price for the night, or the base rate after the rules. */
  price: number;
  /** The owner set this night's price. */
  custom: boolean;
  blocked: boolean;
  minStay: number | null;
};

export type GridStay = {
  id: string;
  ref: string;
  guestName: string;
  status: Extract<ReservationStatus, 'HOLD' | 'CONFIRMED'>;
  source: ReservationSource;
  guests: number;
  checkIn: number;
  checkOut: number;
};

export type GridRoom = {
  id: string;
  number: number;
  name: string;
  element: string;
  icon: string;
  nights: GridNight[];
  stays: GridStay[];
};

/** Every active room for `days` nights from `from`: prices, blocks and the bookings that sit on them. */
export async function adminGrid(from: number, days: number, now = new Date()): Promise<GridRoom[]> {
  const to = from + days;
  const [rooms, rules, rows, stays] = await Promise.all([
    prisma.room.findMany({
      where: { active: true },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, name: true, element: true, icon: true, baseRate: true },
    }),
    loadRules(),
    prisma.roomDay.findMany({
      where: { date: { gte: toDate(from), lt: toDate(to) } },
      select: { roomId: true, date: true, blocked: true, price: true, minStay: true },
    }),
    prisma.reservation.findMany({
      where: {
        checkIn: { lt: toDate(to) },
        checkOut: { gt: toDate(from) },
        OR: [{ status: 'CONFIRMED' }, { status: 'HOLD', holdUntil: { gt: now } }],
      },
      orderBy: { checkIn: 'asc' },
      select: { id: true, ref: true, guestName: true, status: true, source: true, guests: true, roomId: true, checkIn: true, checkOut: true },
    }),
  ]);

  const byNight = new Map(rows.map((r) => [`${r.roomId}:${dayOf(r.date)}`, r]));
  return rooms.map(({ baseRate, ...room }) => ({
    ...room,
    nights: nightsOf(from, to).map((day) => {
      const row = byNight.get(`${room.id}:${day}`);
      return {
        price: row?.price ?? nightlyRate(baseRate, day, rules),
        custom: row?.price != null,
        blocked: row?.blocked ?? false,
        minStay: row?.minStay ?? null,
      };
    }),
    stays: stays
      .filter((s) => s.roomId === room.id)
      .map(({ roomId: _, checkIn, checkOut, status, ...s }) => ({
        ...s,
        status: status as GridStay['status'],
        checkIn: dayOf(checkIn),
        checkOut: dayOf(checkOut),
      })),
  }));
}

/* ------------------------------------------------------- closing, pricing */

export type NightsChange = {
  blocked?: boolean;
  /** Cents; null goes back to the rate rules. */
  price?: number | null;
  /** Null removes the minimum. */
  minStay?: number | null;
};

/**
 * Applies one change to every night from `from` up to `until` in each room.
 * Closing nights that are already booked doesn't cancel those bookings; the
 * result says how many there were so the owner can be told.
 */
export async function setNights(roomIds: string[], from: number, until: number, change: NightsChange, now = new Date()) {
  if (!roomIds.length) throw new AdminError('INVALID', 'Choose at least one room.');
  if (!(until > from) || until - from > MAX_RANGE_DAYS) throw new AdminError('INVALID', 'Choose up to a year of nights at a time.');
  if (change.price != null && (!Number.isInteger(change.price) || change.price < 100 || change.price > MAX_PRICE)) {
    throw new AdminError('INVALID', 'Enter a nightly price between $1 and $10,000.');
  }
  if (change.minStay != null && (!Number.isInteger(change.minStay) || change.minStay < 1 || change.minStay > 30)) {
    throw new AdminError('INVALID', 'Enter a minimum stay between 1 and 30 nights.');
  }
  const data = Object.fromEntries(Object.entries(change).filter(([, v]) => v !== undefined));
  if (!Object.keys(data).length) throw new AdminError('INVALID', 'Nothing to change.');

  const ids = [...new Set(roomIds)];
  if ((await prisma.room.count({ where: { id: { in: ids } } })) !== ids.length) throw new AdminError('NOT_FOUND', 'One of those rooms no longer exists.');

  return prisma.$transaction(async (tx) => {
    const nights = await lockNights(tx, ids.map((roomId) => ({ roomId, from, until })), now);
    await tx.roomDay.updateMany({
      where: { roomId: { in: ids }, date: { gte: toDate(from), lt: toDate(until) } },
      data,
    });
    return { nights: nights.length, booked: nights.filter((n) => n.live).length };
  });
}

/* ------------------------------------------------------- owner's bookings */

/** Dates for a booking the owner enters: past dates are allowed (a walk-in recorded late). */
export function adminStay(checkInIso: string, checkOutIso: string, now = new Date()) {
  const checkIn = parseDay(checkInIso);
  const checkOut = parseDay(checkOutIso);
  if (checkIn === null || checkOut === null) throw new AdminError('INVALID', 'Enter a check-in and a check-out date.');
  if (checkOut <= checkIn) throw new AdminError('INVALID', 'Check-out must be after check-in.');
  if (checkOut - checkIn > MAX_ADMIN_NIGHTS) throw new AdminError('INVALID', `Stays are limited to ${MAX_ADMIN_NIGHTS} nights.`);
  const t = today(now);
  if (checkIn < t - 365 || checkIn > t + 730) throw new AdminError('INVALID', 'Choose dates within a year back and two years ahead.');
  return { checkIn, checkOut };
}

export type AdminQuote = Quote & { adjusted?: true };

function price(
  baseRate: number,
  checkIn: number,
  checkOut: number,
  nights: LockedNight[],
  rules: Rule[],
  settings: PricingSettings,
  total: number | null,
): AdminQuote {
  const overrides = new Map(nights.flatMap((n) => (n.price !== null ? [[n.day, n.price] as const] : [])));
  const q = quote({ baseRate, checkIn, checkOut, rules, settings, overrides });
  if (total === null || total === q.total) return q;
  if (!Number.isInteger(total) || total < 0 || total > MAX_PRICE * MAX_ADMIN_NIGHTS) throw new AdminError('INVALID', 'Enter a valid total.');
  return { ...q, total, adjusted: true };
}

/** Throws UNAVAILABLE, naming who or what has the nights, unless they are free (or already `self`'s). */
async function assertFree(tx: Tx, roomName: string, nights: LockedNight[], self?: string) {
  const blocked = nights.filter((n) => n.blocked);
  const taken = nights.filter((n) => n.live && n.occupantId !== self);
  if (!blocked.length && !taken.length) return;

  const parts: string[] = [];
  if (taken.length) {
    const ids = [...new Set(taken.map((n) => n.occupantId!))];
    const who = await tx.reservation.findMany({ where: { id: { in: ids } }, select: { ref: true, guestName: true, status: true } });
    parts.push(
      `booked on ${span(taken)} (${who.map((w) => `${w.ref}, ${w.guestName}${w.status === 'HOLD' ? ', awaiting payment' : ''}`).join('; ')})`,
    );
  }
  if (blocked.length) parts.push(`closed on ${span(blocked)}`);
  throw new AdminError('UNAVAILABLE', `${roomName} is ${parts.join(' and ')}.`);
}

/** "3 Dec", "3–5 Dec" or "3 Dec, 7 Dec" for a set of nights. */
function span(nights: LockedNight[]) {
  const days = [...new Set(nights.map((n) => n.day))].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const d of days) {
    const last = runs.at(-1);
    if (last && d === last[1] + 1) last[1] = d;
    else runs.push([d, d]);
  }
  return runs.map(([a, b]) => (a === b ? shortDate(a) : `${shortDate(a)} – ${shortDate(b)}`)).join(', ');
}

export type ManualBookingInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guest: { name: string; email?: string; phone?: string; country?: string; arrivalTime?: string; notes?: string };
  ownerNotes?: string;
  /** Cents; null charges the usual price. */
  total: number | null;
};

async function roomFor(roomId: string, guests: number) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AdminError('NOT_FOUND', 'That room no longer exists.');
  if (!Number.isInteger(guests) || guests < 1 || guests > room.maxGuests) {
    throw new AdminError('INVALID', `${room.name} sleeps up to ${room.maxGuests}.`);
  }
  return room;
}

/** A confirmed booking the owner took by phone, WhatsApp or at the door. No minimum stay applies. */
export async function createManualBooking(input: ManualBookingInput, now = new Date()): Promise<Reservation> {
  const { checkIn, checkOut } = adminStay(input.checkIn, input.checkOut, now);
  if (input.guest.name.trim().length < 2) throw new AdminError('INVALID', 'Enter the name the booking is for.');
  const [room, rules, settings] = await Promise.all([roomFor(input.roomId, input.guests), loadRules(), loadSettings()]);

  return prisma.$transaction(
    async (tx) => {
      const nights = await lockNights(tx, [{ roomId: room.id, from: checkIn, until: checkOut }], now);
      await assertFree(tx, room.name, nights);
      await expireStale(tx, nights);
      const q = price(room.baseRate, checkIn, checkOut, nights, rules, settings, input.total);
      const reservation = await tx.reservation.create({
        data: {
          ref: newRef(),
          roomId: room.id,
          checkIn: toDate(checkIn),
          checkOut: toDate(checkOut),
          guests: input.guests,
          status: 'CONFIRMED',
          source: 'MANUAL',
          guestName: input.guest.name.trim(),
          email: input.guest.email?.trim() ?? '',
          phone: input.guest.phone || null,
          country: input.guest.country || null,
          arrivalTime: input.guest.arrivalTime || null,
          notes: input.guest.notes || null,
          ownerNotes: input.ownerNotes || null,
          currency: q.currency,
          total: q.total,
          breakdown: q,
        },
      });
      await tx.roomDay.updateMany({
        where: { roomId: room.id, date: { gte: toDate(checkIn), lt: toDate(checkOut) } },
        data: { reservationId: reservation.id },
      });
      return reservation;
    },
    { maxWait: 10_000, timeout: 10_000 },
  );
}

export type MoveInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Cents; null re-prices the stay at today's rates. */
  total: number | null;
};

/** Moves a confirmed booking to other dates, another room, or both. */
export async function moveReservation(id: string, input: MoveInput, now = new Date()): Promise<Reservation> {
  const { checkIn, checkOut } = adminStay(input.checkIn, input.checkOut, now);
  const [current, room, rules, settings] = await Promise.all([
    prisma.reservation.findUnique({ where: { id } }),
    roomFor(input.roomId, input.guests),
    loadRules(),
    loadSettings(),
  ]);
  if (!current) throw new AdminError('NOT_FOUND', 'That booking no longer exists.');

  return prisma.$transaction(
    async (tx) => {
      const nights = await lockNights(
        tx,
        [
          { roomId: current.roomId, from: dayOf(current.checkIn), until: dayOf(current.checkOut) },
          { roomId: room.id, from: checkIn, until: checkOut },
        ],
        now,
      );
      // Read again under the lock: a payment or a cancel may have got in first.
      const r = await tx.reservation.findUniqueOrThrow({ where: { id } });
      if (r.status !== 'CONFIRMED') throw new AdminError('NOT_EDITABLE', 'Only confirmed bookings can be changed.');

      const target = nights.filter((n) => n.roomId === room.id && n.day >= checkIn && n.day < checkOut);
      await assertFree(tx, room.name, target, id);
      await expireStale(tx, target, id);

      const q = price(room.baseRate, checkIn, checkOut, target, rules, settings, input.total);
      await tx.roomDay.updateMany({ where: { reservationId: id }, data: { reservationId: null } });
      await tx.roomDay.updateMany({
        where: { roomId: room.id, date: { gte: toDate(checkIn), lt: toDate(checkOut) } },
        data: { reservationId: id },
      });
      const moved = await tx.reservation.update({
        where: { id },
        data: {
          roomId: room.id,
          checkIn: toDate(checkIn),
          checkOut: toDate(checkOut),
          guests: input.guests,
          total: q.total,
          breakdown: q,
        },
      });
      // Its old nights may belong to a booking that overlapped it.
      await reclaimNights(tx, [{ roomId: r.roomId, from: dayOf(r.checkIn), until: dayOf(r.checkOut) }]);
      return moved;
    },
    { maxWait: 10_000, timeout: 10_000 },
  );
}

/**
 * Cancels a booking or a hold and reopens its nights. Payments are left as
 * they are: refunds are made in PayHere, and the admin shows what was paid.
 */
export async function cancelReservation(id: string, now = new Date()): Promise<{ reservation: Reservation; was: ReservationStatus }> {
  const current = await prisma.reservation.findUnique({ where: { id } });
  if (!current) throw new AdminError('NOT_FOUND', 'That booking no longer exists.');

  return prisma.$transaction(async (tx) => {
    await lockNights(tx, [{ roomId: current.roomId, from: dayOf(current.checkIn), until: dayOf(current.checkOut) }], now);
    const r = await tx.reservation.findUniqueOrThrow({ where: { id } });
    if (r.status === 'CANCELLED') throw new AdminError('NOT_EDITABLE', 'This booking is already cancelled.');
    if (r.status === 'EXPIRED') throw new AdminError('NOT_EDITABLE', 'This hold has already expired.');
    await tx.roomDay.updateMany({ where: { reservationId: id }, data: { reservationId: null } });
    const reservation = await tx.reservation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: now, holdUntil: null },
    });
    await reclaimNights(tx, [{ roomId: r.roomId, from: dayOf(r.checkIn), until: dayOf(r.checkOut) }]);
    return { reservation, was: r.status };
  });
}

/** The price the stay would cost today, for the manual booking and move forms. */
export async function adminQuote(roomId: string, checkInIso: string, checkOutIso: string, now = new Date()) {
  const { checkIn, checkOut } = adminStay(checkInIso, checkOutIso, now);
  const [room, rules, settings, rows] = await Promise.all([
    prisma.room.findUnique({ where: { id: roomId }, select: { baseRate: true } }),
    loadRules(),
    loadSettings(),
    prisma.roomDay.findMany({
      where: { roomId, date: { gte: toDate(checkIn), lt: toDate(checkOut) }, price: { not: null } },
      select: { date: true, price: true },
    }),
  ]);
  if (!room) throw new AdminError('NOT_FOUND', 'That room no longer exists.');
  const overrides = new Map(rows.map((r) => [dayOf(r.date), r.price!]));
  return quote({ baseRate: room.baseRate, checkIn, checkOut, rules, settings, overrides });
}
