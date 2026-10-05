import { holdRoom } from '@vyona/core';
import { prisma } from '@vyona/db';
import { bookingFailure, canHold, clientIp, countHold, fail, json, parseHold } from '@/lib/booking';

// Holds a room while the guest reviews and pays.
// POST /api/bookings { room, checkIn, checkOut, guests, guest: { name, email, phone, country?, arrival?, notes? } }
// → 201 { id, ref, holdUntil, quote }. `id` is what the guest's browser uses
// to pay for or release this hold, so it is never shown on a page.

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!canHold(ip)) {
    return fail('RATE_LIMITED', 'Too many holds from this connection. Try again in 15 minutes, or message us to book.', 429);
  }
  const parsed = parseHold(await req.json().catch(() => null));
  if (!parsed.ok) return fail('INVALID_DETAILS', parsed.message, 400, parsed.field);

  const room = await prisma.room.findFirst({ where: { slug: parsed.room, active: true }, select: { id: true } });
  try {
    const r = await holdRoom({ ...parsed.input, roomId: room?.id ?? '' });
    countHold(ip);
    return json({ id: r.id, ref: r.ref, holdUntil: r.holdUntil, quote: r.breakdown }, 201);
  } catch (err) {
    return bookingFailure(err);
  }
}
