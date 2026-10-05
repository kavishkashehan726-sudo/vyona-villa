// What happens to a hold after the guest reviews it: paying, confirming,
// releasing. Every function locks the reservation's nights before touching the
// reservation, the order holdRoom and expireHolds use, so none of them can
// deadlock against each other.

import { prisma, type Payment, type PaymentStatus, type Prisma, type Reservation } from '@vyona/db';
import { BookingError } from './booking';
import { dayOf } from './dates';
import { expireStale, lockNights } from './nights';
import { outcomeOf, payhereAmount, type PayHereNotify } from './payhere';
import { loadSettings } from './settings';

type Tx = Prisma.TransactionClient;
type Stay = Pick<Reservation, 'id' | 'roomId' | 'checkIn' | 'checkOut'>;

/** Creates and locks the stay's RoomDay rows; returns who holds each night. */
const lockStay = (tx: Tx, r: Stay, now: Date) =>
  lockNights(tx, [{ roomId: r.roomId, from: dayOf(r.checkIn), until: dayOf(r.checkOut) }], now);

export type ConfirmResult = 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'LOST';

/**
 * Confirms a reservation inside `tx`. A hold that ran out still confirms if
 * nobody else took its nights in the meantime: the guest paid, so the nights
 * are taken back. LOST means another booking or a block has them.
 */
async function confirmIn(tx: Tx, stay: Stay, now: Date): Promise<ConfirmResult> {
  const nights = await lockStay(tx, stay, now);
  const r = await tx.reservation.findUniqueOrThrow({ where: { id: stay.id }, select: { status: true } });
  if (r.status === 'CONFIRMED') return 'ALREADY_CONFIRMED';
  if (r.status === 'CANCELLED') return 'LOST';

  const theirs = nights.filter((n) => n.occupantId !== stay.id);
  if (theirs.some((n) => n.blocked || n.live)) return 'LOST';
  if (theirs.length) {
    await expireStale(tx, theirs, stay.id);
    await tx.roomDay.updateMany({
      where: { roomId: stay.roomId, date: { gte: stay.checkIn, lt: stay.checkOut } },
      data: { reservationId: stay.id },
    });
  }
  await tx.reservation.update({ where: { id: stay.id }, data: { status: 'CONFIRMED' } });
  return 'CONFIRMED';
}

/** A live hold, or the reason it can't be paid for. */
async function liveHold(reservationId: string, now: Date) {
  const r = await prisma.reservation.findUnique({ where: { id: reservationId }, include: { room: true } });
  if (!r) throw new BookingError('HOLD_EXPIRED');
  if (r.status === 'CONFIRMED' || r.status === 'CANCELLED') throw new BookingError('NOT_HELD');
  if (r.status !== 'HOLD' || !r.holdUntil || r.holdUntil <= now) throw new BookingError('HOLD_EXPIRED');
  return r;
}

/** The amount to charge in the configured currency, in that currency's cents. */
export function chargeAmount(totalUsdCents: number, settings: { chargeCurrency: 'USD' | 'LKR'; lkrPerUsd: number }) {
  if (settings.chargeCurrency === 'USD') return { amount: totalUsdCents, currency: 'USD' as const };
  // Whole rupees: nobody pays 30.45 rupees.
  return { amount: Math.round((totalUsdCents * settings.lkrPerUsd) / 100) * 100, currency: 'LKR' as const };
}

/** Opens a new PayHere order for a live hold. Every attempt gets its own order id. */
export async function startPayment(reservationId: string, now = new Date()) {
  const [reservation, settings] = await Promise.all([liveHold(reservationId, now), loadSettings()]);
  const { amount, currency } = chargeAmount(reservation.total, settings);
  const attempts = await prisma.payment.count({ where: { reservationId } });
  const payment = await prisma.payment.create({
    data: { reservationId, orderId: `${reservation.ref}-${attempts + 1}`, amount, currency },
  });
  return { reservation, payment };
}

/** Confirms a live hold with nothing paid yet, when the pay-at-villa setting allows it. */
export async function confirmAtVilla(reservationId: string, now = new Date()): Promise<Reservation> {
  const r = await liveHold(reservationId, now);
  return prisma.$transaction(async (tx) => {
    const result = await confirmIn(tx, r, now);
    if (result === 'LOST') throw new BookingError('UNAVAILABLE');
    if (result === 'ALREADY_CONFIRMED') throw new BookingError('NOT_HELD');
    const { amount, currency } = chargeAmount(r.total, await loadSettings(tx));
    await tx.payment.create({
      data: { reservationId: r.id, provider: 'VILLA', orderId: `${r.ref}-VILLA`, amount, currency },
    });
    return tx.reservation.findUniqueOrThrow({ where: { id: r.id } });
  });
}

/** Lets go of a hold the guest stepped back from. False if it was no longer a hold. */
export async function releaseHold(reservationId: string, now = new Date()): Promise<boolean> {
  const r = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!r || r.status !== 'HOLD') return false;
  return prisma.$transaction(async (tx) => {
    await lockStay(tx, r, now);
    const { count } = await tx.reservation.updateMany({
      where: { id: r.id, status: 'HOLD' },
      data: { status: 'EXPIRED', holdUntil: now },
    });
    if (count) await tx.roomDay.updateMany({ where: { reservationId: r.id }, data: { reservationId: null } });
    return count > 0;
  });
}

export type NotifyResult =
  /** Paid and the booking is confirmed: send the emails, tell Beds24. */
  | 'CONFIRMED'
  /** The same notify again: nothing changed. */
  | 'DUPLICATE'
  /** Paid, but the nights are gone or the booking was already paid: the owner must refund. */
  | 'NEEDS_REFUND'
  /** Not a payment (cancelled, failed, pending, chargeback): status recorded. */
  | 'RECORDED'
  | 'UNKNOWN_ORDER'
  /** Signed, but not for the amount or currency this order asked for. */
  | 'MISMATCH';

const STATUS: Record<Exclude<ReturnType<typeof outcomeOf>, null>, PaymentStatus> = {
  PAID: 'PAID',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  CHARGEDBACK: 'REFUNDED',
};

/**
 * Applies a PayHere notify whose signature the caller has already checked.
 * PayHere retries notifies, so this is idempotent: the payment row is locked
 * first and a payment already marked PAID is never applied twice.
 */
export async function applyPaymentNotify(
  p: PayHereNotify,
  now = new Date(),
): Promise<{ result: NotifyResult; payment?: Payment }> {
  const outcome = outcomeOf(p.status_code);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Payment" WHERE "orderId" = ${p.order_id} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { orderId: p.order_id }, include: { reservation: true } });
    if (!payment || payment.provider !== 'PAYHERE') return { result: 'UNKNOWN_ORDER' as const };

    const raw = { ...p } as Prisma.InputJsonObject;
    if (!outcome || p.payhere_amount !== payhereAmount(payment.amount) || p.payhere_currency !== payment.currency) {
      await tx.payment.update({ where: { id: payment.id }, data: { raw } });
      return { result: 'MISMATCH' as const, payment };
    }

    if (outcome === 'PAID') {
      if (payment.status === 'PAID') return { result: 'DUPLICATE' as const, payment };
      const paid = await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'PAID', paymentId: p.payment_id ?? null, raw },
      });
      const result = await confirmIn(tx, payment.reservation, now);
      return { result: result === 'CONFIRMED' ? ('CONFIRMED' as const) : ('NEEDS_REFUND' as const), payment: paid };
    }

    // A late "cancelled" or "failed" must not overwrite a payment that went through.
    if (payment.status === 'PAID' && outcome !== 'CHARGEDBACK') return { result: 'DUPLICATE' as const, payment };
    const updated = await tx.payment.update({ where: { id: payment.id }, data: { status: STATUS[outcome], raw } });
    return { result: 'RECORDED' as const, payment: updated };
  });
}
