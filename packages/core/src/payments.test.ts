// Runs against the vyona_test database (see test/global-setup.ts).

import { prisma } from '@vyona/db';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BookingError, holdRoom, type HoldInput } from './booking';
import { toIso, today } from './dates';
import { payhereAmount, signNotify, type PayHereConfig } from './payhere';
import { applyPaymentNotify, chargeAmount, confirmAtVilla, releaseHold, startPayment } from './payments';

const cfg: PayHereConfig = { merchantId: 'M1', secret: 's', checkoutUrl: 'x', mock: false };
const guest = { name: 'Test Guest', email: 'guest@example.com', phone: '+94 77 000 0000' };
let roomId: string;
let n = 0;

beforeEach(async () => {
  n += 1;
  const room = await prisma.room.create({
    data: {
      slug: `pay-${n}-${Date.now()}`,
      number: 800 + n,
      name: `Pay ${n}`,
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

const start = today() + 40;
const stay = (from: number, nights: number): HoldInput => ({
  roomId,
  checkIn: toIso(start + from),
  checkOut: toIso(start + from + nights),
  guests: 2,
  guest,
});

const notify = (orderId: string, amount: number, status = '2', currency = 'USD') =>
  signNotify(cfg, {
    merchant_id: 'M1',
    order_id: orderId,
    payment_id: `P${orderId}`,
    payhere_amount: payhereAmount(amount),
    payhere_currency: currency,
    status_code: status,
  });

const statusOf = async (id: string) => (await prisma.reservation.findUniqueOrThrow({ where: { id } })).status;

describe('startPayment', () => {
  it('opens a new order for each attempt', async () => {
    const hold = await holdRoom(stay(0, 2));
    const a = await startPayment(hold.id);
    const b = await startPayment(hold.id);
    expect(a.payment.orderId).toBe(`${hold.ref}-1`);
    expect(b.payment.orderId).toBe(`${hold.ref}-2`);
    expect(a.payment).toMatchObject({ amount: hold.total, currency: 'USD', status: 'PENDING' });
  });

  it('refuses a hold that ran out', async () => {
    const hold = await holdRoom(stay(0, 2), new Date(Date.now() - 20 * 60_000));
    await expect(startPayment(hold.id)).rejects.toMatchObject({ code: 'HOLD_EXPIRED' });
    await expect(startPayment('nope')).rejects.toBeInstanceOf(BookingError);
  });
});

describe('applyPaymentNotify', () => {
  it('confirms once, however often PayHere retries', async () => {
    const hold = await holdRoom(stay(0, 2));
    const { payment } = await startPayment(hold.id);
    const p = notify(payment.orderId, payment.amount);

    const results = await Promise.all([1, 2, 3].map(() => applyPaymentNotify(p)));
    expect(results.map((r) => r.result).sort()).toEqual(['CONFIRMED', 'DUPLICATE', 'DUPLICATE']);
    expect(await statusOf(hold.id)).toBe('CONFIRMED');
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid).toMatchObject({ status: 'PAID', paymentId: `P${payment.orderId}` });
    expect(paid.raw).toMatchObject({ status_code: '2' });
  });

  it('records a cancelled payment and keeps the hold', async () => {
    const hold = await holdRoom(stay(0, 2));
    const { payment } = await startPayment(hold.id);
    expect((await applyPaymentNotify(notify(payment.orderId, payment.amount, '-1'))).result).toBe('RECORDED');
    expect(await statusOf(hold.id)).toBe('HOLD');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('CANCELLED');
  });

  it('never lets a late failure undo a payment', async () => {
    const hold = await holdRoom(stay(0, 2));
    const { payment } = await startPayment(hold.id);
    await applyPaymentNotify(notify(payment.orderId, payment.amount));
    expect((await applyPaymentNotify(notify(payment.orderId, payment.amount, '-2'))).result).toBe('DUPLICATE');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe('PAID');
  });

  it('ignores a notify for another amount or currency', async () => {
    const hold = await holdRoom(stay(0, 2));
    const { payment } = await startPayment(hold.id);
    expect((await applyPaymentNotify(notify(payment.orderId, 100))).result).toBe('MISMATCH');
    expect((await applyPaymentNotify(notify(payment.orderId, payment.amount, '2', 'LKR'))).result).toBe('MISMATCH');
    expect((await applyPaymentNotify(notify('VY-NOPE-1', 100))).result).toBe('UNKNOWN_ORDER');
    expect(await statusOf(hold.id)).toBe('HOLD');
  });

  it('confirms a late payment when the nights are still free', async () => {
    const hold = await holdRoom(stay(0, 2));
    const { payment } = await startPayment(hold.id);
    await prisma.$executeRaw`UPDATE "Reservation" SET "holdUntil" = now() - interval '1 minute' WHERE id = ${hold.id}`;
    expect((await applyPaymentNotify(notify(payment.orderId, payment.amount))).result).toBe('CONFIRMED');
    expect(await prisma.roomDay.count({ where: { reservationId: hold.id } })).toBe(2);
  });

  it('flags a late payment for a refund when another guest took the nights', async () => {
    const hold = await holdRoom(stay(0, 2));
    const { payment } = await startPayment(hold.id);
    await prisma.$executeRaw`UPDATE "Reservation" SET "holdUntil" = now() - interval '1 minute' WHERE id = ${hold.id}`;
    const other = await holdRoom(stay(1, 2));

    expect((await applyPaymentNotify(notify(payment.orderId, payment.amount))).result).toBe('NEEDS_REFUND');
    expect(await statusOf(hold.id)).toBe('EXPIRED');
    expect(await statusOf(other.id)).toBe('HOLD');
  });
});

describe('confirmAtVilla', () => {
  it('confirms and records what is owed on arrival', async () => {
    const hold = await holdRoom(stay(0, 2));
    const res = await confirmAtVilla(hold.id);
    expect(res.status).toBe('CONFIRMED');
    const pay = await prisma.payment.findFirstOrThrow({ where: { reservationId: hold.id } });
    expect(pay).toMatchObject({ provider: 'VILLA', status: 'PENDING', amount: hold.total });
    await expect(confirmAtVilla(hold.id)).rejects.toMatchObject({ code: 'NOT_HELD' });
  });
});

describe('releaseHold', () => {
  it('frees the nights for the next guest', async () => {
    const hold = await holdRoom(stay(0, 2));
    expect(await releaseHold(hold.id)).toBe(true);
    expect(await releaseHold(hold.id)).toBe(false);
    expect(await statusOf(hold.id)).toBe('EXPIRED');
    expect((await holdRoom(stay(0, 2))).status).toBe('HOLD');
  });
});

it('charges whole rupees when the currency is LKR', () => {
  expect(chargeAmount(21450, { chargeCurrency: 'USD', lkrPerUsd: 300 })).toEqual({ amount: 21450, currency: 'USD' });
  expect(chargeAmount(21450, { chargeCurrency: 'LKR', lkrPerUsd: 301.7 })).toEqual({ amount: 6471500, currency: 'LKR' });
});
