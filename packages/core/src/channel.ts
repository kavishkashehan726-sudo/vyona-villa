// Booking.com through Beds24, both ways.
//
// Out: our confirmed bookings become Beds24 bookings, so Beds24 counts them
// and closes the nights on Booking.com itself. Nights the owner closes go as a
// blackout, and every night carries its price and minimum stay. We never send
// a raw availability count: a Booking.com booking that hasn't reached us yet
// would be overwritten by it.
//
// In: a webhook (or the 10-minute poll) names a booking; the worker fetches it
// from the API, the authoritative copy, and applies it by its Beds24 id, so
// replays change nothing. A Booking.com booking takes nights from unpaid holds
// (the guest paying late then gets the refund path) but never from a confirmed
// booking: it is recorded anyway and the owner is told it is overbooked.
//
// Every exchange is written to SyncLog. Only the worker runs these, one job at
// a time, so pushes and imports never race each other.

import { prisma, type Prisma, type Reservation } from '@vyona/db';
import { beds24, Beds24Error, type Beds24Booking, type CalendarRange, type OutBooking, type RoomCalendar } from './beds24';
import { newRef } from './booking';
import { dayOf, nightsOf, parseDay, toDate, toIso, today } from './dates';
import { expireStale, lockNights, reclaimNights } from './nights';
import { nightlyRate } from './pricing';
import { loadRules } from './settings';

type Tx = Prisma.TransactionClient;

/** How far ahead prices and closures are sent. */
export const ARI_DAYS = 365;
/** The Setting row holding when the last poll finished. */
export const POLLED_AT = 'beds24.polledAt';
const OCCUPYING = new Set(['confirmed', 'new', 'request', 'black']);

type Log = { direction: 'OUT' | 'IN'; kind: string; ref?: string | null; payload: unknown; status: string; error?: string };

export async function logSync(entry: Log) {
  await prisma.syncLog.create({
    data: { ...entry, ref: entry.ref ?? null, payload: (entry.payload ?? {}) as Prisma.InputJsonValue },
  });
}

/** Runs one exchange, logging how it went; failures are rethrown so the job retries. */
async function logged<T>(
  entry: Omit<Log, 'status' | 'error'>,
  run: () => Promise<T>,
  status: (r: T) => [status: string, error?: string] = () => ['ok'],
) {
  try {
    const result = await run();
    const [s, error] = status(result);
    await logSync({ ...entry, status: s, error });
    return result;
  } catch (err) {
    await logSync({ ...entry, status: 'error', error: (err as Error).message.slice(0, 1000) });
    throw err;
  }
}

const dollars = (cents: number) => Math.round(cents) / 100;

/* -------------------------------------------------- prices and closures */

/** Runs of identical nights, with `to` as the last night (Beds24's inclusive end). */
export function toRanges(nights: { day: number; price1: number; minStay: number | null; override: CalendarRange['override'] }[]) {
  const out: CalendarRange[] = [];
  let run: (CalendarRange & { last: number }) | null = null;
  for (const n of nights) {
    if (run && n.day === run.last + 1 && n.price1 === run.price1 && n.minStay === run.minStay && n.override === run.override) {
      run.last = n.day;
      continue;
    }
    if (run) out.push(finish(run));
    run = { from: toIso(n.day), to: '', last: n.day, price1: n.price1, minStay: n.minStay, override: n.override };
  }
  if (run) out.push(finish(run));
  return out;
}

function finish({ last, ...range }: CalendarRange & { last: number }): CalendarRange {
  return { ...range, to: toIso(last) };
}

export type AriInput = { roomIds?: string[]; from?: string; until?: string };

/** Sends each linked room's nightly price, minimum stay and closures for the range (default: the next year). */
export async function pushAri(input: AriInput = {}, now = new Date()): Promise<string> {
  const client = beds24();
  if (!client) return 'skipped: Booking.com sync is off';
  const first = today(now);
  const from = Math.max(first, (input.from && parseDay(input.from)) || first);
  const until = Math.min(first + ARI_DAYS, (input.until && parseDay(input.until)) || first + ARI_DAYS);
  if (until <= from) return 'skipped: nothing ahead to send';

  const [rooms, rules, rows] = await Promise.all([
    prisma.room.findMany({
      where: { beds24RoomId: { not: null }, ...(input.roomIds?.length ? { id: { in: input.roomIds } } : {}) },
      select: { id: true, name: true, active: true, baseRate: true, beds24RoomId: true },
    }),
    loadRules(),
    prisma.roomDay.findMany({
      where: { date: { gte: toDate(from), lt: toDate(until) }, ...(input.roomIds?.length ? { roomId: { in: input.roomIds } } : {}) },
      select: { roomId: true, date: true, blocked: true, price: true, minStay: true },
    }),
  ]);
  if (!rooms.length) return 'skipped: no room is linked to Beds24';

  const byNight = new Map(rows.map((r) => [`${r.roomId}:${dayOf(r.date)}`, r]));
  const payload: RoomCalendar[] = rooms.map((room) => ({
    roomId: room.beds24RoomId!,
    calendar: toRanges(
      nightsOf(from, until).map((day) => {
        const row = byNight.get(`${room.id}:${day}`);
        return {
          day,
          price1: dollars(row?.price ?? nightlyRate(room.baseRate, day, rules)),
          minStay: row?.minStay ?? null,
          // A room taken off the site is closed on Booking.com too.
          override: !room.active || row?.blocked ? 'blackout' : 'none',
        };
      }),
    ),
  }));

  const summary = { from: toIso(from), until: toIso(until), rooms: rooms.map((r) => r.name), ranges: payload.reduce((s, r) => s + r.calendar.length, 0) };
  await logged({ direction: 'OUT', kind: 'ari.push', payload: summary }, () => client.setCalendar(payload));
  return `sent ${summary.ranges} price ranges for ${rooms.length} room${rooms.length === 1 ? '' : 's'}, ${summary.from} to ${summary.until}`;
}

/* ------------------------------------------------------- our bookings out */

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1)! } : { firstName: '', lastName: parts[0] ?? '' };
}

/**
 * Brings Beds24 in line with one of our reservations: creates or updates it
 * while it is confirmed, cancels it once it isn't. A Booking.com booking the
 * owner moved sends only its new room and dates.
 */
export async function pushBooking(reservationId: string): Promise<string> {
  const client = beds24();
  if (!client) return 'skipped: Booking.com sync is off';
  const r = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { room: { select: { beds24RoomId: true } } } });
  if (!r) return `skipped: reservation ${reservationId} is gone`;
  const externalId = r.externalId ? Number(r.externalId) : null;
  const entry = { direction: 'OUT' as const, ref: r.ref };

  if (r.status === 'HOLD') return `skipped: ${r.ref} is not confirmed`;
  if (r.status !== 'CONFIRMED') {
    if (!externalId) return `skipped: ${r.ref} never reached Beds24`;
    await logged({ ...entry, kind: 'booking.cancel', payload: { id: externalId } }, () => client.cancelBooking(externalId));
    return `cancelled ${r.ref} in Beds24 (${externalId})`;
  }

  const roomId = r.room.beds24RoomId;
  if (!roomId) {
    // Moved into a room that isn't on Booking.com: the old room's nights reopen there.
    if (!externalId) return `skipped: ${r.ref}'s room is not linked to Beds24`;
    await logged({ ...entry, kind: 'booking.cancel', payload: { id: externalId, reason: 'room not linked' } }, () => client.cancelBooking(externalId));
    await prisma.reservation.update({ where: { id: r.id }, data: { externalId: null } });
    return `cancelled ${r.ref} in Beds24: its new room is not linked`;
  }

  const stay = { roomId, arrival: toIso(dayOf(r.checkIn)), departure: toIso(dayOf(r.checkOut)), numAdult: r.guests };
  let booking: OutBooking;
  if (r.source === 'BOOKING_COM') {
    if (!externalId) return `skipped: ${r.ref} has no Beds24 id`;
    booking = { id: externalId, ...stay };
  } else {
    // A retry after a push that reached Beds24 but not our database: reuse that booking.
    const id = externalId ?? (await client.findByReference(r.ref))?.id;
    booking = {
      ...(id ? { id } : {}),
      ...stay,
      status: 'confirmed',
      ...splitName(r.guestName),
      email: r.email,
      phone: r.phone ?? '',
      country: r.country ?? '',
      arrivalTime: r.arrivalTime ?? '',
      comments: r.notes ?? '',
      price: dollars(r.total),
      apiReference: r.ref,
      referer: r.source === 'MANUAL' ? 'VYONA admin' : 'VYONA website',
    };
  }

  const id = await logged({ ...entry, kind: booking.id ? 'booking.update' : 'booking.create', payload: { ...booking, email: undefined, phone: undefined } }, () =>
    client.saveBooking(booking),
  );
  if (String(id) !== r.externalId) await prisma.reservation.update({ where: { id: r.id }, data: { externalId: String(id) } });
  return `${booking.id ? 'updated' : 'created'} ${r.ref} in Beds24 (${id})`;
}

/* ------------------------------------------------- Booking.com bookings in */

export type ImportResult = {
  outcome: 'ours' | 'created' | 'updated' | 'unchanged' | 'cancelled' | 'ignored' | 'unlinked';
  reservation?: Reservation;
  /** Refs of confirmed bookings already on nights this one was sold for. */
  conflicts: string[];
  /** Nights the owner had closed that were sold anyway. */
  closed: string[];
  /** Holds that lost their nights to this booking. */
  bumped: string[];
};

const guestName = (b: Beds24Booking) =>
  [b.firstName, b.lastName].filter((s) => s?.trim()).join(' ').trim() || (b.status === 'black' ? 'Closed in Beds24' : 'Booking.com guest');

/** Applies one booking from Beds24 to our calendar. Safe to repeat. */
export async function importBooking(b: Beds24Booking, now = new Date()): Promise<ImportResult> {
  const none = { conflicts: [], closed: [], bumped: [] };
  const externalId = String(b.id);

  // Ours, coming back: just remember its Beds24 id.
  if (b.apiReference) {
    const ours = await prisma.reservation.findUnique({ where: { ref: b.apiReference } });
    if (ours && ours.source !== 'BOOKING_COM') {
      if (!ours.externalId) await prisma.reservation.update({ where: { id: ours.id }, data: { externalId } }).catch(() => undefined);
      return { outcome: 'ours', reservation: ours, ...none };
    }
  }

  const existing = await prisma.reservation.findUnique({ where: { externalId } });
  if (existing && existing.source !== 'BOOKING_COM') return { outcome: 'ours', reservation: existing, ...none };
  const occupying = OCCUPYING.has(b.status);

  if (!occupying) {
    if (!existing || existing.status !== 'CONFIRMED') return { outcome: 'ignored', reservation: existing ?? undefined, ...none };
    const reservation = await prisma.$transaction(async (tx) => {
      const old = { roomId: existing.roomId, from: dayOf(existing.checkIn), until: dayOf(existing.checkOut) };
      await lockNights(tx, [old], now);
      await tx.roomDay.updateMany({ where: { reservationId: existing.id }, data: { reservationId: null } });
      const cancelled = await tx.reservation.update({ where: { id: existing.id }, data: { status: 'CANCELLED', cancelledAt: now } });
      await reclaimNights(tx, [old]);
      return cancelled;
    });
    return { outcome: 'cancelled', reservation, ...none };
  }

  const room = await prisma.room.findUnique({ where: { beds24RoomId: b.roomId }, select: { id: true } });
  if (!room) return { outcome: 'unlinked', reservation: existing ?? undefined, ...none };
  const checkIn = parseDay(b.arrival);
  const checkOut = parseDay(b.departure);
  if (checkIn === null || checkOut === null || checkOut <= checkIn) throw new Beds24Error(`Booking ${b.id} has unusable dates ${b.arrival} → ${b.departure}`);

  const data = {
    roomId: room.id,
    checkIn: toDate(checkIn),
    checkOut: toDate(checkOut),
    guests: Math.max(1, (b.numAdult ?? 0) + (b.numChild ?? 0)),
    status: 'CONFIRMED' as const,
    source: 'BOOKING_COM' as const,
    holdUntil: null,
    cancelledAt: null,
    guestName: guestName(b),
    email: b.email?.trim() ?? '',
    phone: b.phone?.trim() || b.mobile?.trim() || null,
    country: b.country?.trim() || b.country2?.trim() || null,
    arrivalTime: b.arrivalTime?.trim() || null,
    notes: b.comments?.trim() || null,
    currency: 'USD',
    total: Math.round((b.price ?? 0) * 100),
    breakdown: { channel: b.channel || 'beds24', reference: b.reference ?? null, price: b.price ?? 0, commission: b.commission ?? null },
    externalId,
  };

  const sameStay =
    existing?.status === 'CONFIRMED' &&
    existing.roomId === data.roomId &&
    dayOf(existing.checkIn) === checkIn &&
    dayOf(existing.checkOut) === checkOut;

  return prisma.$transaction(
    async (tx) => {
      const target = { roomId: room.id, from: checkIn, until: checkOut };
      const old = existing ? { roomId: existing.roomId, from: dayOf(existing.checkIn), until: dayOf(existing.checkOut) } : null;
      const nights = await lockNights(tx, old ? [old, target] : [target], now);
      const mine = nights.filter((n) => n.roomId === room.id && n.day >= checkIn && n.day < checkOut);
      const others = mine.filter((n) => n.live && n.occupantId !== existing?.id);

      const occupants = await tx.reservation.findMany({
        where: { id: { in: [...new Set(others.map((n) => n.occupantId!))] } },
        select: { id: true, ref: true, status: true },
      });
      const holds = occupants.filter((o) => o.status === 'HOLD');
      const conflicts = occupants.filter((o) => o.status === 'CONFIRMED').map((o) => o.ref);
      const closed = mine.filter((n) => n.blocked).map((n) => toIso(n.day));

      if (holds.length) {
        await tx.roomDay.updateMany({ where: { reservationId: { in: holds.map((h) => h.id) } }, data: { reservationId: null } });
        await tx.reservation.updateMany({ where: { id: { in: holds.map((h) => h.id) }, status: 'HOLD' }, data: { status: 'EXPIRED' } });
      }
      await expireStale(tx, mine, existing?.id);

      const reservation = existing
        ? await tx.reservation.update({ where: { id: existing.id }, data })
        : await tx.reservation.create({ data: { ...data, ref: newRef() } });

      if (!sameStay) {
        await tx.roomDay.updateMany({ where: { reservationId: reservation.id }, data: { reservationId: null } });
      }
      await tx.roomDay.updateMany({
        where: { roomId: room.id, date: { gte: toDate(checkIn), lt: toDate(checkOut) }, reservationId: null },
        data: { reservationId: reservation.id },
      });
      if (old && !sameStay) await reclaimNights(tx, [old]);

      const outcome = !existing ? 'created' : sameStay && existing.guests === data.guests && existing.total === data.total ? 'unchanged' : 'updated';
      return { outcome, reservation, conflicts, closed, bumped: holds.map((h) => h.ref) };
    },
    { maxWait: 10_000, timeout: 10_000 },
  );
}

/** What the worker does when a webhook or the poll names a booking. */
export async function pullBooking(bookingId: number, now = new Date()): Promise<ImportResult | 'off' | 'missing'> {
  const client = beds24();
  if (!client) return 'off';
  const booking = await logged(
    { direction: 'IN', kind: 'booking.fetch', ref: String(bookingId), payload: { id: bookingId } },
    () => client.getBooking(bookingId),
    (b) => (b ? ['ok'] : ['missing', 'Beds24 has no booking with this id']),
  );
  if (!booking) return 'missing';
  return applyLogged(booking, now);
}

function applyLogged(booking: Beds24Booking, now: Date) {
  return logged(
    { direction: 'IN', kind: 'booking.import', ref: String(booking.id), payload: summary(booking) },
    () => importBooking(booking, now),
    (r) => {
      if (r.outcome === 'unlinked') return ['error', `Beds24 room ${booking.roomId} is not linked to a room here`];
      const why = [
        r.conflicts.length && `sold over ${r.conflicts.join(', ')}`,
        r.closed.length && `sold on closed nights ${r.closed.join(', ')}`,
      ].filter(Boolean);
      return why.length ? ['conflict', `${r.reservation?.ref}: ${why.join('; ')}`] : ['ok'];
    },
  );
}

/** What gets logged about a booking: no contact details. */
const summary = (b: Beds24Booking) => ({
  id: b.id,
  roomId: b.roomId,
  status: b.status,
  arrival: b.arrival,
  departure: b.departure,
  channel: b.channel ?? null,
  apiReference: b.apiReference ?? null,
  modifiedTime: b.modifiedTime ?? null,
});

/* ---------------------------------------------------------- the safety net */

export type PollResult = { seen: number; imported: ImportResult[]; pushed: number; errors: string[] };

/**
 * The 10-minute fallback: pulls every booking Beds24 changed since the last
 * poll (with a few minutes' overlap, as imports are idempotent), then pushes
 * any confirmed booking of ours that never reached Beds24 (Redis was down, or
 * the push gave up). The checkpoint only moves on when everything applied.
 */
export async function pollBookings(now = new Date()): Promise<PollResult | 'off'> {
  const client = beds24();
  if (!client) return 'off';
  const row = await prisma.setting.findUnique({ where: { key: POLLED_AT } });
  const last = typeof row?.value === 'string' ? new Date(row.value) : new Date(now.getTime() - 2 * 86_400_000);
  const since = new Date(last.getTime() - 5 * 60_000);

  const changed = await logged(
    { direction: 'IN', kind: 'poll', payload: { since: since.toISOString() } },
    () => client.modifiedSince(since),
  );
  const result: PollResult = { seen: changed.length, imported: [], pushed: 0, errors: [] };
  for (const booking of changed) {
    try {
      result.imported.push(await applyLogged(booking, now));
    } catch (err) {
      result.errors.push(`${booking.id}: ${(err as Error).message}`);
    }
  }

  const missing = await prisma.reservation.findMany({
    where: {
      status: 'CONFIRMED',
      source: { not: 'BOOKING_COM' },
      externalId: null,
      checkOut: { gt: toDate(today(now)) },
      room: { beds24RoomId: { not: null } },
    },
    select: { id: true, ref: true },
    take: 20,
  });
  for (const r of missing) {
    try {
      await pushBooking(r.id);
      result.pushed += 1;
    } catch (err) {
      result.errors.push(`${r.ref}: ${(err as Error).message}`);
    }
  }

  if (!result.errors.length) {
    await prisma.setting.upsert({ where: { key: POLLED_AT }, create: { key: POLLED_AT, value: now.toISOString() }, update: { value: now.toISOString() } });
  }
  return result;
}
