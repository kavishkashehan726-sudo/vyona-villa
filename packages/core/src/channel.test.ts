// Booking.com through Beds24, against the mock. Runs on the vyona_test database
// (see test/global-setup.ts).

import { prisma } from '@vyona/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { cancelReservation, createManualBooking, moveReservation, setNights } from './admin';
import { Beds24Mock, memoryStore, useBeds24 } from './beds24';
import { holdRoom } from './booking';
import { importBooking, pollBookings, POLLED_AT, pullBooking, pushAri, pushBooking, toRanges } from './channel';
import { toDate, toIso, today } from './dates';

let mock: Beds24Mock;
let roomId: string;
let b24: number;
let n = 0;

async function room(over: { beds24RoomId?: number | null; active?: boolean } = {}) {
  n += 1;
  return prisma.room.create({
    data: {
      slug: `channel-${n}-${Date.now()}`,
      number: 600 + n,
      name: `Room ${n}`,
      element: 'Test',
      icon: 'earth',
      category: 'King',
      sizeSqm: 20,
      maxGuests: 2,
      baseRate: 6500,
      beds24RoomId: 900_000 + n,
      ...over,
    },
  });
}

beforeEach(async () => {
  // Beds24 ids are unique for good; a fresh mock per test must not reuse an earlier test's.
  const store = memoryStore();
  await store.set('b24mock:seq', String(n * 1000));
  mock = new Beds24Mock(store);
  useBeds24(mock);
  const r = await room();
  roomId = r.id;
  b24 = r.beds24RoomId!;
});

afterAll(async () => {
  useBeds24(undefined);
  await prisma.$disconnect();
});

const start = today() + 60;
const iso = (offset: number) => toIso(start + offset);

/** Who holds each night of the room, from `from` for `nights` nights. */
async function occupants(from: number, nights: number, id = roomId) {
  const rows = await prisma.roomDay.findMany({
    where: { roomId: id, date: { gte: toDate(start + from), lt: toDate(start + from + nights) } },
    orderBy: { date: 'asc' },
  });
  return Array.from({ length: nights }, (_, i) => rows.find((r) => r.date.getTime() === toDate(start + from + i).getTime())?.reservationId ?? null);
}

const manual = (from: number, nights: number, id = roomId) =>
  createManualBooking({
    roomId: id,
    checkIn: iso(from),
    checkOut: iso(from + nights),
    guests: 2,
    guest: { name: 'Walk In Guest', phone: '+94 77 000 0000' },
    total: null,
  });

const sell = (from: number, nights: number, force = false) =>
  mock.sell({ roomId: b24, arrival: iso(from), departure: iso(from + nights), firstName: 'Anna', lastName: 'Berg', force });

async function pull(id: number) {
  const result = await pullBooking(id);
  if (typeof result === 'string') throw new Error(`pull gave ${result}`);
  return result;
}

describe('toRanges', () => {
  it('joins nights that match and splits on any change or gap', () => {
    const night = (day: number, price1 = 65, override: 'none' | 'blackout' = 'none') => ({ day, price1, minStay: null, override });
    expect(toRanges([night(start), night(start + 1), night(start + 2, 80), night(start + 3, 80, 'blackout'), night(start + 5, 80, 'blackout')])).toEqual([
      { from: iso(0), to: iso(1), price1: 65, minStay: null, override: 'none' },
      { from: iso(2), to: iso(2), price1: 80, minStay: null, override: 'none' },
      { from: iso(3), to: iso(3), price1: 80, minStay: null, override: 'blackout' },
      { from: iso(5), to: iso(5), price1: 80, minStay: null, override: 'blackout' },
    ]);
    expect(toRanges([])).toEqual([]);
  });
});

describe('pushAri', () => {
  it('sends each night’s price and minimum stay, and closed nights as a blackout', async () => {
    await setNights([roomId], start + 2, start + 3, { blocked: true });
    await setNights([roomId], start + 5, start + 7, { price: 12000, minStay: 3 });
    await pushAri({ roomIds: [roomId], from: iso(0), until: iso(10) });

    const cal = await mock.calendar(b24);
    expect(Object.keys(cal)).toHaveLength(10);
    expect(cal[iso(0)]).toEqual({ price1: 65, minStay: null, override: 'none' });
    expect(cal[iso(2)]!.override).toBe('blackout');
    expect(cal[iso(5)]).toEqual({ price1: 120, minStay: 3, override: 'none' });
    expect(cal[iso(7)]!.price1).toBe(65);
    expect(await prisma.syncLog.count({ where: { kind: 'ari.push', status: 'ok' } })).toBeGreaterThan(0);
  });

  it('closes every night of a room taken off the website, and skips unlinked rooms', async () => {
    const off = await room({ active: false });
    const unlinked = await room({ beds24RoomId: null });
    await pushAri({ roomIds: [off.id, unlinked.id], from: iso(0), until: iso(4) });
    const cal = await mock.calendar(off.beds24RoomId!);
    expect(Object.values(cal).map((d) => d.override)).toEqual(['blackout', 'blackout', 'blackout', 'blackout']);
    expect(await pushAri({ roomIds: [unlinked.id] })).toMatch(/no room is linked/);
  });

  it('is off without a client', async () => {
    useBeds24(undefined);
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(await pushAri()).toMatch(/off/);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe('pushBooking', () => {
  it('creates our booking in Beds24 once, updates it on a move, and cancels it', async () => {
    const r = await manual(0, 3);
    expect(await pushBooking(r.id)).toMatch(/^created/);
    const id = Number((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).externalId);
    let b = (await mock.getBooking(id))!;
    expect(b).toMatchObject({ roomId: b24, arrival: iso(0), departure: iso(3), status: 'confirmed', apiReference: r.ref, price: r.total / 100 });
    expect(b.firstName).toBe('Walk In');
    expect(b.lastName).toBe('Guest');

    await moveReservation(r.id, { roomId, checkIn: iso(4), checkOut: iso(6), guests: 2, total: null });
    expect(await pushBooking(r.id)).toMatch(/^updated/);
    b = (await mock.getBooking(id))!;
    expect([b.arrival, b.departure]).toEqual([iso(4), iso(6)]);

    await cancelReservation(r.id);
    await pushBooking(r.id);
    expect((await mock.getBooking(id))!.status).toBe('cancelled');
    expect(await mock.bookings()).toHaveLength(1);
  });

  it('reuses the Beds24 booking when an earlier push never saved its id', async () => {
    const r = await manual(0, 2);
    await pushBooking(r.id);
    await prisma.reservation.update({ where: { id: r.id }, data: { externalId: null } });
    expect(await pushBooking(r.id)).toMatch(/^updated/);
    expect(await mock.bookings()).toHaveLength(1);
  });

  it('cancels it in Beds24 when it moves to a room that isn’t linked', async () => {
    const r = await manual(0, 2);
    await pushBooking(r.id);
    const unlinked = await room({ beds24RoomId: null });
    await moveReservation(r.id, { roomId: unlinked.id, checkIn: iso(0), checkOut: iso(2), guests: 2, total: null });
    expect(await pushBooking(r.id)).toMatch(/not linked/);
    expect((await mock.bookings())[0]!.status).toBe('cancelled');
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: r.id } })).externalId).toBeNull();
  });

  it('leaves holds alone', async () => {
    const hold = await holdRoom({ roomId, checkIn: iso(0), checkOut: iso(2), guests: 2, guest: { name: 'Web Guest', email: 'web@example.com' } });
    expect(await pushBooking(hold.id)).toMatch(/not confirmed/);
    expect(await mock.bookings()).toHaveLength(0);
  });
});

describe('importing Booking.com bookings', () => {
  it('records a booking on its nights, and a replay changes nothing', async () => {
    const sale = await sell(0, 3);
    const first = await pull(sale.id);
    expect(first.outcome).toBe('created');
    expect(first.reservation).toMatchObject({ source: 'BOOKING_COM', status: 'CONFIRMED', guestName: 'Anna Berg', externalId: String(sale.id) });
    expect(await occupants(0, 3)).toEqual([first.reservation!.id, first.reservation!.id, first.reservation!.id]);

    const again = await pull(sale.id);
    expect(again.outcome).toBe('unchanged');
    expect(await prisma.reservation.count({ where: { externalId: String(sale.id) } })).toBe(1);
  });

  it('follows a change of dates made on Booking.com', async () => {
    const sale = await sell(0, 3);
    const { reservation } = await pull(sale.id);
    await mock.saveBooking({ id: sale.id, roomId: b24, arrival: iso(2), departure: iso(4), numAdult: 2 });
    expect((await pull(sale.id)).outcome).toBe('updated');
    expect(await occupants(0, 4)).toEqual([null, null, reservation!.id, reservation!.id]);
  });

  it('frees the nights when the guest cancels', async () => {
    const sale = await sell(0, 2);
    await pull(sale.id);
    await mock.cancelSale(sale.id);
    const result = await pull(sale.id);
    expect(result.outcome).toBe('cancelled');
    expect(result.reservation!.status).toBe('CANCELLED');
    expect(await occupants(0, 2)).toEqual([null, null]);
    expect((await pull(sale.id)).outcome).toBe('ignored');
  });

  it('takes the nights from an unpaid hold', async () => {
    const hold = await holdRoom({ roomId, checkIn: iso(1), checkOut: iso(3), guests: 2, guest: { name: 'Web Guest', email: 'web@example.com' } });
    const result = await pull((await sell(0, 3)).id);
    expect(result.bumped).toEqual([hold.ref]);
    expect(result.conflicts).toEqual([]);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe('EXPIRED');
    expect(await occupants(0, 3)).toEqual(Array(3).fill(result.reservation!.id));
  });

  it('records an overbooking without taking a confirmed booking’s nights, and hands them over when that one is cancelled', async () => {
    const ours = await manual(1, 2);
    await setNights([roomId], start + 3, start + 4, { blocked: true });
    const result = await pull((await sell(0, 4, true)).id);
    expect(result.conflicts).toEqual([ours.ref]);
    expect(result.closed).toEqual([iso(3)]);
    const theirs = result.reservation!.id;
    expect(await occupants(0, 4)).toEqual([theirs, ours.id, ours.id, theirs]);
    expect(await prisma.syncLog.findFirst({ where: { kind: 'booking.import', status: 'conflict' }, orderBy: { createdAt: 'desc' } })).toMatchObject({
      error: expect.stringContaining(ours.ref),
    });

    await cancelReservation(ours.id);
    expect(await occupants(0, 4)).toEqual(Array(4).fill(theirs));
  });

  it('hands the nights over when the confirmed booking moves away', async () => {
    const ours = await manual(0, 2);
    const theirs = (await pull((await sell(0, 2, true)).id)).reservation!.id;
    await moveReservation(ours.id, { roomId, checkIn: iso(5), checkOut: iso(7), guests: 2, total: null });
    expect(await occupants(0, 2)).toEqual([theirs, theirs]);
  });

  it('recognises our own bookings coming back', async () => {
    const r = await manual(0, 2);
    await pushBooking(r.id);
    const [b] = await mock.bookings();
    expect((await importBooking(b!)).outcome).toBe('ours');
    expect(await prisma.reservation.count({ where: { roomId } })).toBe(1);
  });

  it('logs a booking for a room that isn’t linked as a problem', async () => {
    const sale = await mock.sell({ roomId: 1, arrival: iso(0), departure: iso(2), firstName: 'Anna', lastName: 'Berg' });
    expect((await pull(sale.id)).outcome).toBe('unlinked');
    const log = await prisma.syncLog.findFirst({ where: { kind: 'booking.import', ref: String(sale.id) } });
    expect(log).toMatchObject({ status: 'error', error: expect.stringMatching(/not linked/) });
  });

  it('reports a booking Beds24 doesn’t have', async () => {
    expect(await pullBooking(123)).toBe('missing');
  });
});

describe('pollBookings', () => {
  it('imports what changed, pushes what Beds24 is missing, and moves the checkpoint', async () => {
    const a = await sell(0, 2);
    const b = await sell(3, 2);
    const ours = await manual(6, 2);
    const result = await pollBookings();
    if (result === 'off') throw new Error('off');

    expect(result.errors).toEqual([]);
    expect(result.imported.filter((r) => r.outcome === 'created').map((r) => r.reservation!.externalId)).toEqual([String(a.id), String(b.id)]);
    expect(result.pushed).toBeGreaterThanOrEqual(1);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: ours.id } })).externalId).not.toBeNull();
    const checkpoint = await prisma.setting.findUniqueOrThrow({ where: { key: POLLED_AT } });
    expect(Date.parse(checkpoint.value as string)).toBeGreaterThan(Date.now() - 60_000);
  });

  it('keeps the checkpoint when something fails, so the next poll tries again', async () => {
    const before = new Date(Date.now() - 3_600_000).toISOString();
    await prisma.setting.upsert({ where: { key: POLLED_AT }, create: { key: POLLED_AT, value: before }, update: { value: before } });
    await mock.saveBooking({ roomId: b24, arrival: iso(2), departure: iso(2), numAdult: 2 });
    const result = await pollBookings();
    if (result === 'off') throw new Error('off');
    expect(result.errors).toHaveLength(1);
    expect((await prisma.setting.findUniqueOrThrow({ where: { key: POLLED_AT } })).value).toBe(before);
  });
});
