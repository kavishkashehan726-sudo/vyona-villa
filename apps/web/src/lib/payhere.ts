// The one path every PayHere notify takes, real or from the mock gateway.

import { afterConfirm, applyPaymentNotify, needsRefund, verifyNotify, type NotifyResult, type PayHereConfig, type PayHereNotify } from '@vyona/core';
import { prisma } from '@vyona/db';

export async function handleNotify(cfg: PayHereConfig, p: PayHereNotify): Promise<NotifyResult | 'BAD_SIGNATURE'> {
  if (!verifyNotify(cfg, p)) {
    console.warn(`[payhere] rejected notify for ${p.order_id}: bad signature`);
    return 'BAD_SIGNATURE';
  }
  const { result, payment } = await applyPaymentNotify(p);
  console.log(`[payhere] ${p.order_id} status ${p.status_code}: ${result}`);
  if (!payment) return result;

  // Queued after the commit. If Redis is down this throws, PayHere retries,
  // and the retry (a DUPLICATE) queues again; job ids keep it to one email.
  if (result === 'CONFIRMED') await afterConfirm(payment.reservationId);
  if (result === 'DUPLICATE' && payment.status === 'PAID') {
    const r = await prisma.reservation.findUnique({ where: { id: payment.reservationId }, select: { status: true } });
    if (r?.status === 'CONFIRMED') await afterConfirm(payment.reservationId);
  }
  if (result === 'NEEDS_REFUND') await needsRefund(payment.reservationId, payment.orderId);
  return result;
}
