import { afterConfirm, checkoutFields, confirmAtVilla, dayOf, loadSettings, payhereConfig, startPayment } from '@vyona/core';
import { bookingFailure, fail, json } from '@/lib/booking';
import { SITE_URL } from '@/lib/site';

// POST /api/bookings/:id/pay { method: 'card' | 'villa' }
//   card  → { checkout: { action, method, fields } }: the browser posts the
//           signed form to PayHere (or, in development, the mock gateway)
//   villa → { status: 'CONFIRMED', ref }, only when the payAtVilla setting is on

export async function POST(req: Request, ctx: RouteContext<'/api/bookings/[id]/pay'>) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { method?: string };

  try {
    if (body.method === 'villa') {
      if (!(await loadSettings()).payAtVilla) {
        return fail('PAY_AT_VILLA_OFF', 'Bookings are paid online when you book. Choose card to continue.');
      }
      const r = await confirmAtVilla(id);
      // The booking stands even if the emails can't be queued right now.
      await afterConfirm(r.id).catch((err) => console.error(`[booking] ${r.ref}: could not queue emails`, err));
      return json({ status: r.status, ref: r.ref });
    }

    const cfg = payhereConfig();
    if (!cfg) {
      return fail('PAYMENTS_UNAVAILABLE', 'Online payment isn’t switched on yet. Message us on WhatsApp and we’ll confirm your booking.', 503);
    }
    const { reservation: r, payment } = await startPayment(id);
    const nights = dayOf(r.checkOut) - dayOf(r.checkIn);
    const fields = checkoutFields(cfg, {
      orderId: payment.orderId,
      amount: payment.amount,
      currency: payment.currency === 'LKR' ? 'LKR' : 'USD',
      items: `VYONA ${r.room.name} · ${nights} night${nights === 1 ? '' : 's'} · ${r.ref}`,
      guest: { name: r.guestName, email: r.email, phone: r.phone ?? '', country: r.country },
      returnUrl: `${SITE_URL}/book/${r.ref}?payment=done`,
      cancelUrl: `${SITE_URL}/book/${r.ref}?payment=cancelled`,
      notifyUrl: `${SITE_URL}/api/payhere/notify`,
    });
    return json({ checkout: { action: cfg.checkoutUrl, method: cfg.mock ? 'get' : 'post', fields } });
  } catch (err) {
    return bookingFailure(err);
  }
}
