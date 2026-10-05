// Holding a room is the one place two guests can race for the same night, so
// it runs as a single transaction that locks the room's nights first:
//
//   1. make sure a RoomDay row exists for every night (rows are created lazily)
//   2. SELECT … FOR UPDATE those rows, in date order
//   3. re-check them under the lock, then point them at a new HOLD reservation
//
// A second request for any of the same nights waits at step 2 and then sees the
// first one's hold. Holds that ran out are taken over in place, so nothing
// depends on the expiry job having run.

import { randomInt } from 'node:crypto';
import { prisma, type Reservation, type ReservationSource } from '@vyona/db';
import { checkStay, type StayError } from './availability';
import { nightsOf, toDate } from './dates';
import { quote } from './pricing';
import { loadRules, loadSettings } from './settings';

export type BookingErrorCode = StayError | 'ROOM_NOT_FOUND' | 'TOO_MANY_GUESTS' | 'MIN_STAY' | 'UNAVAILABLE';

export class BookingError extends Error {
  constructor(
    readonly code: BookingErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export type HoldInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  guest: {
    name: string;
    email: string;
    phone?: string;
    country?: string;
    arrivalTime?: string;
    notes?: string;
  };
  source?: ReservationSource;
};

// No 0/O, 1/I/L: the reference gets read out over the phone.
const REF_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export function newRef(): string {
  let s = 'VY-';
  for (let i = 0; i < 5; i++) s += REF_CHARS[randomInt(REF_CHARS.length)];
  return s;
}

type LockedNight = {
  blocked: boolean;
  price: number | null;
  minStay: number | null;
  occupantId: string | null;
  live: boolean;
};

export async function holdRoom(input: HoldInput, now = new Date()): Promise<Reservation> {
  const stay = checkStay(input.checkIn, input.checkOut, now);
  if ('error' in stay) throw new BookingError(stay.error);
  const { checkIn, checkOut } = stay;

  const [room, rules, settings] = await Promise.all([
    prisma.room.findFirst({ where: { id: input.roomId, active: true } }),
    loadRules(),
    loadSettings(),
  ]);
  if (!room) throw new BookingError('ROOM_NOT_FOUND');
  if (input.guests < 1 || input.guests > room.maxGuests) throw new BookingError('TOO_MANY_GUESTS');

  const from = input.checkIn;
  const until = input.checkOut;

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "RoomDay" ("roomId", "date", "updatedAt")
        SELECT ${room.id}, d::date, now()
        FROM generate_series(${from}::date, ${until}::date - 1, interval '1 day') AS d
        ON CONFLICT DO NOTHING`;

      await tx.$queryRaw`
        SELECT 1 FROM "RoomDay"
        WHERE "roomId" = ${room.id} AND "date" >= ${from}::date AND "date" < ${until}::date
        ORDER BY "date"
        FOR UPDATE`;

      // Read in a second statement: under READ COMMITTED, a statement that
      // waited for the lock re-reads the locked rows but still joins against its
      // old snapshot, where the winner's reservation does not exist yet.
      const nights = await tx.$queryRaw<LockedNight[]>`
        SELECT d.blocked, d.price, d."minStay", d."reservationId" AS "occupantId",
               COALESCE(r.status = 'CONFIRMED' OR (r.status = 'HOLD' AND r."holdUntil" > ${now}), false) AS live
        FROM "RoomDay" d
        LEFT JOIN "Reservation" r ON r.id = d."reservationId"
        WHERE d."roomId" = ${room.id} AND d."date" >= ${from}::date AND d."date" < ${until}::date
        ORDER BY d."date"`;

      if (nights.some((n) => n.blocked || n.live)) throw new BookingError('UNAVAILABLE');
      const minStay = nights[0]?.minStay;
      if (minStay && checkOut - checkIn < minStay) {
        throw new BookingError('MIN_STAY', `Minimum stay from this date is ${minStay} nights`);
      }

      // Holds that ran out but were never expired by the worker.
      const stale = [...new Set(nights.flatMap((n) => (n.occupantId ? [n.occupantId] : [])))];
      if (stale.length) {
        await tx.reservation.updateMany({
          where: { id: { in: stale }, status: 'HOLD' },
          data: { status: 'EXPIRED' },
        });
      }

      const days = nightsOf(checkIn, checkOut);
      const overrides = new Map<number, number>();
      nights.forEach((n, i) => n.price !== null && overrides.set(days[i]!, n.price));
      const q = quote({ baseRate: room.baseRate, checkIn, checkOut, rules, settings, overrides });

      const reservation = await tx.reservation.create({
        data: {
          ref: newRef(),
          roomId: room.id,
          checkIn: toDate(checkIn),
          checkOut: toDate(checkOut),
          guests: input.guests,
          status: 'HOLD',
          source: input.source ?? 'DIRECT',
          holdUntil: new Date(now.getTime() + settings.holdMinutes * 60_000),
          guestName: input.guest.name,
          email: input.guest.email,
          phone: input.guest.phone,
          country: input.guest.country,
          arrivalTime: input.guest.arrivalTime,
          notes: input.guest.notes,
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
    // Under load, requests queue for a pool connection and for the row locks.
    { maxWait: 10_000, timeout: 10_000 },
  );
}

/**
 * Marks holds past their deadline as EXPIRED and frees their nights. Locks the
 * nights before the reservations, the same order holdRoom uses, so the two
 * can't deadlock.
 */
export async function expireHolds(now = new Date()): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT 1 FROM "RoomDay" d
      JOIN "Reservation" r ON r.id = d."reservationId"
      WHERE r.status = 'HOLD' AND r."holdUntil" <= ${now}
      ORDER BY d."roomId", d."date"
      FOR UPDATE OF d`;
    await tx.$executeRaw`
      UPDATE "RoomDay" SET "reservationId" = NULL, "updatedAt" = now()
      WHERE "reservationId" IN (
        SELECT id FROM "Reservation" WHERE status = 'HOLD' AND "holdUntil" <= ${now})`;
    const { count } = await tx.reservation.updateMany({
      where: { status: 'HOLD', holdUntil: { lte: now } },
      data: { status: 'EXPIRED' },
    });
    return count;
  });
}
