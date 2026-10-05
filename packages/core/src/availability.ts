// What a guest sees on the calendar, using the SRS states: available,
// reserved (a hold waiting for payment) and booked. Nights the owner blocked
// show as booked; guests don't need the difference.

import { prisma, type ReservationStatus } from '@vyona/db';
import { nightsOf, parseDay, toDate, toIso, today } from './dates';
import { nightlyRate, quote, type Quote } from './pricing';
import { loadRules, loadSettings } from './settings';

export type DayState = 'free' | 'reserved' | 'booked' | 'past';

export const MAX_NIGHTS = 30;
export const MAX_ADVANCE_DAYS = 540;

type Occupant = { status: ReservationStatus; holdUntil: Date | null } | null;

/** A night is taken by a confirmed booking or by a hold that has not run out. */
export function isLive(occupant: Occupant, now: Date): boolean {
  if (!occupant) return false;
  if (occupant.status === 'CONFIRMED') return true;
  return occupant.status === 'HOLD' && occupant.holdUntil !== null && occupant.holdUntil > now;
}

export function dayState(
  day: number,
  row: { blocked: boolean; reservation: Occupant } | undefined,
  now: Date,
): DayState {
  if (day < today(now)) return 'past';
  if (!row) return 'free';
  if (row.blocked) return 'booked';
  if (!isLive(row.reservation, now)) return 'free';
  return row.reservation!.status === 'HOLD' ? 'reserved' : 'booked';
}

export type StayError = 'INVALID_DATES' | 'TOO_LONG' | 'TOO_FAR_AHEAD';

/** Parses and checks a stay's dates; returns epoch days or the reason it is not bookable. */
export function checkStay(
  checkInIso: string,
  checkOutIso: string,
  now = new Date(),
): { checkIn: number; checkOut: number } | { error: StayError } {
  const checkIn = parseDay(checkInIso);
  const checkOut = parseDay(checkOutIso);
  if (checkIn === null || checkOut === null) return { error: 'INVALID_DATES' };
  if (checkIn < today(now) || checkOut <= checkIn) return { error: 'INVALID_DATES' };
  if (checkOut - checkIn > MAX_NIGHTS) return { error: 'TOO_LONG' };
  if (checkIn > today(now) + MAX_ADVANCE_DAYS) return { error: 'TOO_FAR_AHEAD' };
  return { checkIn, checkOut };
}

const occupant = { select: { status: true, holdUntil: true } } as const;

/** One room's nights from `from` up to `to`, for the booking calendar. */
export async function roomCalendar(roomId: string, from: number, to: number, now = new Date()) {
  const [room, rules, rows] = await Promise.all([
    prisma.room.findUniqueOrThrow({ where: { id: roomId }, select: { baseRate: true } }),
    loadRules(),
    prisma.roomDay.findMany({
      where: { roomId, date: { gte: toDate(from), lt: toDate(to) } },
      include: { reservation: occupant },
    }),
  ]);
  const byDay = new Map(rows.map((r) => [Math.round(r.date.getTime() / 86_400_000), r]));
  return nightsOf(from, to).map((day) => {
    const row = byDay.get(day);
    return {
      date: toIso(day),
      state: dayState(day, row, now),
      price: row?.price ?? nightlyRate(room.baseRate, day, rules),
      minStay: row?.minStay ?? null,
    };
  });
}

export type RoomOffer = {
  roomId: string;
  available: boolean;
  reason?: 'UNAVAILABLE' | 'MIN_STAY';
  minStay?: number;
  quote: Quote;
};

/** Every active room that fits the party, with whether it is free for the stay and its price. */
export async function searchStay(checkIn: number, checkOut: number, guests: number, now = new Date()) {
  const [rooms, rules, settings, rows] = await Promise.all([
    prisma.room.findMany({
      where: { active: true, maxGuests: { gte: guests } },
      orderBy: { number: 'asc' },
      select: { id: true, baseRate: true },
    }),
    loadRules(),
    loadSettings(),
    prisma.roomDay.findMany({
      where: { date: { gte: toDate(checkIn), lt: toDate(checkOut) } },
      include: { reservation: occupant },
    }),
  ]);

  return rooms.map((room): RoomOffer => {
    const own = rows.filter((r) => r.roomId === room.id);
    const overrides = new Map(
      own.filter((r) => r.price !== null).map((r) => [Math.round(r.date.getTime() / 86_400_000), r.price!]),
    );
    const q = quote({ baseRate: room.baseRate, checkIn, checkOut, rules, settings, overrides });
    if (own.some((r) => r.blocked || isLive(r.reservation, now))) {
      return { roomId: room.id, available: false, reason: 'UNAVAILABLE', quote: q };
    }
    const first = own.find((r) => r.date.getTime() === toDate(checkIn).getTime());
    if (first?.minStay && checkOut - checkIn < first.minStay) {
      return { roomId: room.id, available: false, reason: 'MIN_STAY', minStay: first.minStay, quote: q };
    }
    return { roomId: room.id, available: true, quote: q };
  });
}
