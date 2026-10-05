// Runs against the vyona_test database (see test/global-setup.ts).

import { prisma } from '@vyona/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { searchStay } from './availability';
import { BookingError, expireHolds, holdRoom, type HoldInput } from './booking';
import { parseDay, toDate, toIso, today } from './dates';

const guest = { name: 'Test Guest', email: 'guest@example.com' };
let roomId: string;
let n = 0;

// Every test gets its own room, so tests can't see each other's nights.
beforeEach(async () => {
  n += 1;
  const room = await prisma.room.create({
    data: {
      slug: `test-${n}-${Date.now()}`,
      number: 900 + n,
      name: `Test ${n}`,
      element: 'Test',
      icon: 'earth',
      category: 'King',
      sizeSqm: 20,
      maxGuests: 2,
      baseRate: 6500,
    },
  });
  roomId = room.id;
});

afterAll(() => prisma.$disconnect());

// Weekday nights a month out, clear of rate rules (the test database has none).
const start = today() + 30;
const stay = (from: number, nights: number): HoldInput => ({
  roomId,
  checkIn: toIso(start + from),
  checkOut: toIso(start + from + nights),
  guests: 2,
  guest,
});

async function code(p: Promise<unknown>) {
  try {
    await p;
    return 'OK';
  } catch (err) {
    if (err instanceof BookingError) return err.code;
    throw err;
  }
}

describe('holdRoom', () => {
  it('holds the nights and prices the stay', async () => {
    const res = await holdRoom(stay(0, 3));
    expect(res.status).toBe('HOLD');
    expect(res.ref).toMatch(/^VY-[2-9A-Z]{5}$/);
    expect(res.total).toBe(3 * 6500 + 1950); // + 10% service charge
    expect(res.holdUntil!.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);

    const days = await prisma.roomDay.findMany({ where: { roomId }, orderBy: { date: 'asc' } });
    expect(days.map((d) => d.reservationId)).toEqual([res.id, res.id, res.id]);
  });

  // Two cases, because they serialise differently: new nights collide on the
  // RoomDay primary key during the insert, while nights that already have a row
  // (an owner's price, a cancelled booking) are only protected by FOR UPDATE.
  it.each([
    ['new nights', false],
    ['nights that already have a row', true],
  ])('lets exactly one of 20 simultaneous requests hold %s', async (_, existing) => {
    if (existing) {
      await prisma.roomDay.createMany({
        data: [0, 1, 2].map((i) => ({ roomId, date: toDate(start + i), price: 7000 })),
      });
    }
    const results = await Promise.all(Array.from({ length: 20 }, () => code(holdRoom(stay(0, 3)))));
    expect(results.filter((r) => r === 'OK')).toHaveLength(1);
    expect(results.filter((r) => r === 'UNAVAILABLE')).toHaveLength(19);
    expect(await prisma.reservation.count({ where: { roomId } })).toBe(1);
  });

  it('never double-books a night when overlapping stays race', async () => {
    const ranges = Array.from({ length: 16 }, (_, i) => stay(i % 8, 2 + (i % 3)));
    await Promise.all(ranges.map((r) => code(holdRoom(r))));

    const held = await prisma.reservation.findMany({ where: { roomId } });
    const taken = new Set<number>();
    for (const r of held) {
      for (let d = r.checkIn.getTime(); d < r.checkOut.getTime(); d += 86_400_000) {
        expect(taken.has(d)).toBe(false);
        taken.add(d);
      }
    }
    // And every held night points at its own reservation.
    const days = await prisma.roomDay.findMany({ where: { roomId, reservationId: { not: null } } });
    expect(days).toHaveLength(taken.size);
  });

  it('refuses nights the owner blocked', async () => {
    await prisma.roomDay.create({ data: { roomId, date: toDate(start + 1), blocked: true } });
    expect(await code(holdRoom(stay(0, 3)))).toBe('UNAVAILABLE');
    expect(await code(holdRoom(stay(2, 2)))).toBe('OK');
  });

  it('takes over a hold that ran out', async () => {
    const old = await holdRoom(stay(0, 2), new Date(Date.now() - 20 * 60_000));
    const res = await holdRoom(stay(1, 2));
    expect(res.status).toBe('HOLD');
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: old.id } })).status).toBe('EXPIRED');
  });

  it('keeps the minimum stay set on the arrival night', async () => {
    await prisma.roomDay.create({ data: { roomId, date: toDate(start), minStay: 3 } });
    expect(await code(holdRoom(stay(0, 2)))).toBe('MIN_STAY');
    expect(await code(holdRoom(stay(0, 3)))).toBe('OK');
  });

  it('rejects bad requests before touching the calendar', async () => {
    const past = toIso(today() - 1);
    expect(await code(holdRoom({ ...stay(0, 1), checkIn: past }))).toBe('INVALID_DATES');
    expect(await code(holdRoom({ ...stay(0, 1), checkOut: toIso(start) }))).toBe('INVALID_DATES');
    expect(await code(holdRoom(stay(0, 31)))).toBe('TOO_LONG');
    expect(await code(holdRoom({ ...stay(0, 1), guests: 3 }))).toBe('TOO_MANY_GUESTS');
    expect(await code(holdRoom({ ...stay(0, 1), roomId: 'nope' }))).toBe('ROOM_NOT_FOUND');
  });
});

describe('expireHolds', () => {
  it('expires holds past their deadline and frees their nights', async () => {
    const res = await holdRoom(stay(0, 2));
    expect(await expireHolds(new Date())).toBe(0);
    expect(await expireHolds(new Date(Date.now() + 16 * 60_000))).toBeGreaterThanOrEqual(1);

    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: res.id } })).status).toBe('EXPIRED');
    expect(await prisma.roomDay.count({ where: { reservationId: res.id } })).toBe(0);
  });
});

describe('searchStay', () => {
  it('marks a held room unavailable and quotes the rest', async () => {
    await holdRoom(stay(0, 2));
    const checkIn = parseDay(toIso(start))!;
    const offers = await searchStay(checkIn, checkIn + 2, 2);
    const mine = offers.find((o) => o.roomId === roomId)!;
    expect(mine).toMatchObject({ available: false, reason: 'UNAVAILABLE' });
    expect(mine.quote.total).toBe(2 * 6500 + 1300);
  });
});
