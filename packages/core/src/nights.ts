// Locking a stay's nights, shared by everything that changes who occupies them
// after the hold: payments, and the owner's cancels, moves and manual bookings.
// holdRoom keeps its own copy because it also reads prices and minimum stays.

import { Prisma } from '@vyona/db';
import { toIso } from './dates';

type Tx = Prisma.TransactionClient;

/** Nights of one room: `from` up to, not including, `until` (epoch days). */
export type NightRange = { roomId: string; from: number; until: number };

export type LockedNight = {
  roomId: string;
  day: number;
  blocked: boolean;
  price: number | null;
  occupantId: string | null;
  /** The occupant is a confirmed booking or a hold that has not run out. */
  live: boolean;
};

/**
 * Creates any missing RoomDay rows for the ranges, locks them all in
 * (room, date) order (the order holdRoom and expireHolds use, so nothing can
 * deadlock), and returns who holds each night.
 */
export async function lockNights(tx: Tx, ranges: NightRange[], now: Date): Promise<LockedNight[]> {
  const spans = ranges.filter((r) => r.until > r.from);
  if (!spans.length) return [];
  for (const r of spans) {
    await tx.$executeRaw`
      INSERT INTO "RoomDay" ("roomId", "date", "updatedAt")
      SELECT ${r.roomId}, d::date, now()
      FROM generate_series(${toIso(r.from)}::date, ${toIso(r.until)}::date - 1, interval '1 day') AS d
      ON CONFLICT DO NOTHING`;
  }
  const where = Prisma.join(
    spans.map(
      (r) =>
        Prisma.sql`(d."roomId" = ${r.roomId} AND d."date" >= ${toIso(r.from)}::date AND d."date" < ${toIso(r.until)}::date)`,
    ),
    ' OR ',
  );
  await tx.$queryRaw`SELECT 1 FROM "RoomDay" d WHERE ${where} ORDER BY d."roomId", d."date" FOR UPDATE`;
  // Read in a second statement: under READ COMMITTED, a statement that waited
  // for the lock re-reads the locked rows but joins against its old snapshot.
  const rows = await tx.$queryRaw<(Omit<LockedNight, 'day'> & { date: Date })[]>`
    SELECT d."roomId", d."date", d.blocked, d.price, d."reservationId" AS "occupantId",
           COALESCE(r.status = 'CONFIRMED' OR (r.status = 'HOLD' AND r."holdUntil" > ${now}), false) AS live
    FROM "RoomDay" d
    LEFT JOIN "Reservation" r ON r.id = d."reservationId"
    WHERE ${where}
    ORDER BY d."roomId", d."date"`;
  return rows.map(({ date, ...n }) => ({ ...n, day: Math.round(date.getTime() / 86_400_000) }));
}

/** Marks holds that ran out but still sit on these nights as EXPIRED. */
export async function expireStale(tx: Tx, nights: LockedNight[], keep?: string) {
  const stale = [...new Set(nights.flatMap((n) => (n.occupantId && !n.live && n.occupantId !== keep ? [n.occupantId] : [])))];
  if (stale.length) {
    await tx.reservation.updateMany({ where: { id: { in: stale }, status: 'HOLD' }, data: { status: 'EXPIRED' } });
  }
}
