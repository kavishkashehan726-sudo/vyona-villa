// Runs against the vyona_test database (see test/global-setup.ts).

import { prisma } from '@vyona/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { adminGrid, AdminError, cancelReservation, createManualBooking, moveReservation, setNights, type ManualBookingInput } from './admin';
import { roomCalendar, searchStay } from './availability';
import { holdRoom } from './booking';
import { toIso, today } from './dates';
import { confirmAtVilla } from './payments';

let roomId: string;
let otherId: string;
let n = 0;

async function room(rate: number) {
  n += 1;
  return prisma.room.create({
    data: {
      slug: `admin-${n}-${Date.now()}`,
      number: 700 + n,
      name: `Room ${n}`,
      element: 'Test',
      icon: 'earth',
      category: 'King',
      sizeSqm: 20,
      maxGuests: 2,
      baseRate: rate,
    },
  });
}

beforeEach(async () => {
  roomId = (await room(6500)).id;
  otherId = (await room(9500)).id;
});

afterAll(() => prisma.$disconnect());

// Weekday nights well ahead, clear of rate rules (the test database has none).
const start = today() + 60;
const iso = (offset: number) => toIso(start + offset);

const manual = (from: number, nights: number, over: Partial<ManualBookingInput> = {}): ManualBookingInput => ({
  roomId,
  checkIn: iso(from),
  checkOut: iso(from + nights),
  guests: 2,
  guest: { name: 'Walk In', phone: '+94 77 000 0000' },
  total: null,
  ...over,
});

async function failure(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (err) {
    if (err instanceof AdminError) return err;
    throw err;
  }
}

describe('setNights', () => {
  it('closes nights to guests and reopens them', async () => {
    await setNights([roomId], start + 1, start + 3, { blocked: true });
    let offer = (await searchStay(start, start + 2, 2)).find((o) => o.roomId === roomId)!;
    expect(offer.available).toBe(false);

    const cal = await roomCalendar(roomId, start, start + 4);
    expect(cal.map((d) => d.state)).toEqual(['free', 'booked', 'booked', 'free']);

    await setNights([roomId], start + 1, start + 3, { blocked: false });
    offer = (await searchStay(start, start + 2, 2)).find((o) => o.roomId === roomId)!;
    expect(offer.available).toBe(true);
  });

  it('sets a price for the nights, and clearing it goes back to the rules', async () => {
    await setNights([roomId, otherId], start, start + 2, { price: 12000 });
    const offers = await searchStay(start, start + 2, 2);
    expect(offers.find((o) => o.roomId === roomId)!.quote.subtotal).toBe(24000);
    expect(offers.find((o) => o.roomId === otherId)!.quote.subtotal).toBe(24000);

    await setNights([roomId], start, start + 1, { price: null });
    const grid = (await adminGrid(start, 2)).find((r) => r.id === roomId)!;
    expect(grid.nights.map((x) => [x.price, x.custom])).toEqual([
      [6500, false],
      [12000, true],
    ]);
  });

  it('applies a minimum stay that the guest booking respects', async () => {
    await setNights([roomId], start, start + 1, { minStay: 3 });
    const offer = (await searchStay(start, start + 2, 2)).find((o) => o.roomId === roomId)!;
    expect(offer).toMatchObject({ available: false, reason: 'MIN_STAY', minStay: 3 });
  });

  it('counts booked nights it closed without touching the booking', async () => {
    const b = await createManualBooking(manual(0, 2));
    const res = await setNights([roomId], start, start + 4, { blocked: true });
    expect(res).toEqual({ nights: 4, booked: 2 });
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CONFIRMED');
  });

  it('rejects nonsense', async () => {
    expect((await failure(setNights([roomId], start, start, { blocked: true })))?.code).toBe('INVALID');
    expect((await failure(setNights([roomId], start, start + 1, { price: 5 })))?.code).toBe('INVALID');
    expect((await failure(setNights([roomId], start, start + 1, {})))?.code).toBe('INVALID');
    expect((await failure(setNights(['nope'], start, start + 1, { blocked: true })))?.code).toBe('NOT_FOUND');
  });
});

describe('createManualBooking', () => {
  it('confirms the booking straight away, at the usual price unless told otherwise', async () => {
    const a = await createManualBooking(manual(0, 2));
    expect(a).toMatchObject({ status: 'CONFIRMED', source: 'MANUAL', total: 2 * 6500 + 1300, email: '' });
    const b = await createManualBooking(manual(5, 2, { total: 10000 }));
    expect(b.total).toBe(10000);
    expect(b.breakdown).toMatchObject({ adjusted: true, subtotal: 13000 });

    const days = await prisma.roomDay.findMany({ where: { roomId, reservationId: { not: null } } });
    expect(days).toHaveLength(4);
  });

  it('refuses nights that are taken or closed, and says by whom', async () => {
    const hold = await holdRoom({ roomId, checkIn: iso(1), checkOut: iso(3), guests: 2, guest: { name: 'Ann Guest', email: 'a@example.com' } });
    const err = await failure(createManualBooking(manual(0, 2)));
    expect(err?.code).toBe('UNAVAILABLE');
    expect(err?.message).toContain(hold.ref);
    expect(err?.message).toContain('awaiting payment');

    await setNights([roomId], start + 10, start + 11, { blocked: true });
    expect((await failure(createManualBooking(manual(9, 3))))?.message).toMatch(/closed on/);
  });

  it('ignores the minimum stay and takes over a hold that ran out', async () => {
    await setNights([roomId], start, start + 1, { minStay: 5 });
    const past = new Date(Date.now() - 60 * 60_000);
    const stale = await holdRoom({ roomId, checkIn: iso(0), checkOut: iso(5), guests: 2, guest: { name: 'Late', email: 'l@example.com' } }, past);
    const b = await createManualBooking(manual(0, 1));
    expect(b.status).toBe('CONFIRMED');
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe('EXPIRED');
  });

  it('races guests for the same nights and only one of them wins', async () => {
    const guest = (i: number) =>
      holdRoom({ roomId, checkIn: iso(0), checkOut: iso(3), guests: 2, guest: { name: `G${i}`, email: `g${i}@example.com` } }).then(
        () => 'hold',
        () => 'lost',
      );
    const owner = createManualBooking(manual(1, 1)).then(
      () => 'manual',
      (err) => (err instanceof AdminError ? 'lost' : Promise.reject(err)),
    );
    const results = await Promise.all([owner, ...Array.from({ length: 10 }, (_, i) => guest(i))]);
    expect(results.filter((r) => r !== 'lost')).toHaveLength(1);
    expect(await prisma.roomDay.count({ where: { roomId, reservationId: { not: null } } })).toBe(results.includes('manual') ? 1 : 3);
  });

  it('checks the party fits the room', async () => {
    expect((await failure(createManualBooking(manual(0, 1, { guests: 3 }))))?.message).toMatch(/sleeps up to 2/);
  });
});

describe('moveReservation', () => {
  it('moves a booking to other nights in another room and re-prices it', async () => {
    const b = await createManualBooking(manual(0, 2));
    const moved = await moveReservation(b.id, { roomId: otherId, checkIn: iso(1), checkOut: iso(4), guests: 2, total: null });
    expect(moved).toMatchObject({ roomId: otherId, total: 3 * 9500 + 2850 });

    const nights = await prisma.roomDay.findMany({ where: { reservationId: b.id }, orderBy: { date: 'asc' } });
    expect(nights.map((d) => [d.roomId, d.date.toISOString().slice(0, 10)])).toEqual([
      [otherId, iso(1)],
      [otherId, iso(2)],
      [otherId, iso(3)],
    ]);
    // The old nights are free again.
    expect((await searchStay(start, start + 2, 2)).find((o) => o.roomId === roomId)!.available).toBe(true);
  });

  it('can overlap its own nights', async () => {
    const b = await createManualBooking(manual(0, 3));
    const moved = await moveReservation(b.id, { roomId, checkIn: iso(1), checkOut: iso(5), guests: 1, total: 20000 });
    expect(moved).toMatchObject({ total: 20000, guests: 1 });
    expect(await prisma.roomDay.count({ where: { reservationId: b.id } })).toBe(4);
  });

  it("won't move onto someone else's nights, and leaves the booking as it was", async () => {
    const a = await createManualBooking(manual(0, 2));
    const b = await createManualBooking(manual(4, 2));
    const err = await failure(moveReservation(a.id, { roomId, checkIn: iso(3), checkOut: iso(5), guests: 2, total: null }));
    expect(err?.code).toBe('UNAVAILABLE');
    expect(err?.message).toContain(b.ref);
    expect(await prisma.roomDay.count({ where: { reservationId: a.id } })).toBe(2);
  });

  it('only moves confirmed bookings', async () => {
    const hold = await holdRoom({ roomId, checkIn: iso(0), checkOut: iso(1), guests: 2, guest: { name: 'H', email: 'h@example.com' } });
    const err = await failure(moveReservation(hold.id, { roomId, checkIn: iso(2), checkOut: iso(3), guests: 2, total: null }));
    expect(err?.code).toBe('NOT_EDITABLE');
  });
});

describe('cancelReservation', () => {
  it('cancels a confirmed booking and frees its nights for guests', async () => {
    const hold = await holdRoom({ roomId, checkIn: iso(0), checkOut: iso(2), guests: 2, guest: { name: 'C', email: 'c@example.com' } });
    await prisma.setting.upsert({ where: { key: 'payAtVilla' }, create: { key: 'payAtVilla', value: true }, update: { value: true } });
    try {
      await confirmAtVilla(hold.id);
    } finally {
      await prisma.setting.delete({ where: { key: 'payAtVilla' } });
    }
    const { reservation, was } = await cancelReservation(hold.id);
    expect(was).toBe('CONFIRMED');
    expect(reservation.status).toBe('CANCELLED');
    expect(reservation.cancelledAt).not.toBeNull();
    expect(await prisma.roomDay.count({ where: { reservationId: hold.id } })).toBe(0);
    expect((await searchStay(start, start + 2, 2)).find((o) => o.roomId === roomId)!.available).toBe(true);

    expect((await failure(cancelReservation(hold.id)))?.code).toBe('NOT_EDITABLE');
  });

  it('shows on the chart until cancelled', async () => {
    const b = await createManualBooking(manual(1, 2));
    let grid = (await adminGrid(start, 5)).find((r) => r.id === roomId)!;
    expect(grid.stays).toMatchObject([{ id: b.id, checkIn: start + 1, checkOut: start + 3, status: 'CONFIRMED' }]);
    await cancelReservation(b.id);
    grid = (await adminGrid(start, 5)).find((r) => r.id === roomId)!;
    expect(grid.stays).toEqual([]);
  });
});
