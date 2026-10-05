import { timingSafeEqual } from 'node:crypto';
import { beds24Mode, pullFromBeds24 } from '@vyona/core';

// Beds24 calls this when a booking is made, changed or cancelled (Settings →
// Properties → Access → Booking Webhook). Its webhooks carry no signature, so
// the URL holds a secret: https://vyonaweligama.com/api/webhooks/beds24?key=…
//
// Nothing in the body is trusted beyond the booking id. The worker fetches the
// booking from the API and applies it, so the reply goes back well inside
// Beds24's timeout and a forged body can only make us look something up.

function authorised(req: Request) {
  const secret = process.env.BEDS24_WEBHOOK_SECRET?.trim();
  // Without a secret only the mock may call in, and never in production.
  if (!secret) return beds24Mode() === 'mock';
  const given = new URL(req.url).searchParams.get('key') ?? req.headers.get('x-webhook-key') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The booking id, from Beds24's v2 payload ({ booking: { id } }) or the older flat one ({ bookId }). */
async function bookingId(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  const body: Record<string, unknown> = type.includes('json')
    ? ((await req.json().catch(() => null)) ?? {})
    : Object.fromEntries(((await req.formData().catch(() => null)) ?? new FormData()).entries());
  const raw = (body.booking as { id?: unknown } | undefined)?.id ?? body.bookId ?? body.id;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(req: Request) {
  if (beds24Mode() === 'off' || !authorised(req)) return new Response('Not found', { status: 404 });
  const id = await bookingId(req);
  if (!id) return new Response('No booking id', { status: 400 });
  try {
    await pullFromBeds24(id);
  } catch (err) {
    // Beds24 retries a failed webhook, and the 10-minute poll catches it anyway.
    console.error('[beds24 webhook] could not queue booking', id, err);
    return new Response('Try again', { status: 503 });
  }
  return new Response('OK');
}
