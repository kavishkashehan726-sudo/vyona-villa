import { payhereAmount, payhereConfig, signNotify } from '@vyona/core';
import { prisma } from '@vyona/db';
import { handleNotify } from '@/lib/payhere';
import { SITE_URL } from '@/lib/site';

// The mock gateway's buttons post here (development only). It sends a notify
// signed exactly as PayHere would, then returns the guest the way PayHere does.
export async function POST(req: Request) {
  const cfg = payhereConfig();
  if (!cfg?.mock) return new Response('Not found', { status: 404 });

  const form = await req.formData();
  const orderId = String(form.get('order_id') ?? '');
  const paid = form.get('outcome') === 'paid';
  const payment = await prisma.payment.findUnique({ where: { orderId }, include: { reservation: { select: { ref: true } } } });
  if (!payment) return new Response('Unknown order', { status: 404 });

  await handleNotify(
    cfg,
    signNotify(cfg, {
      merchant_id: cfg.merchantId,
      order_id: orderId,
      payment_id: `MOCK${Date.now()}`,
      payhere_amount: payhereAmount(payment.amount),
      payhere_currency: payment.currency,
      status_code: paid ? '2' : '-1',
      method: 'TEST',
    }),
  );
  const back = `${SITE_URL}/book/${payment.reservation.ref}?payment=${paid ? 'done' : 'cancelled'}`;
  return Response.redirect(back, 303);
}
