import { prisma } from '@vyona/db';
import { MAX_ADVANCE_DAYS, parseDay, roomCalendar, today } from '@vyona/core';

export const dynamic = 'force-dynamic';

// One room's nights for the booking calendar: state, price and minimum stay.
// GET /api/calendar?room=dhara&from=2026-11-01&to=2027-01-01  (to is exclusive)

const MAX_SPAN = 93;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const from = parseDay(q.get('from') ?? '');
  const to = parseDay(q.get('to') ?? '');
  if (from === null || to === null || to <= from) {
    return Response.json({ error: 'INVALID_DATES' }, { status: 400 });
  }
  const room = await prisma.room.findFirst({ where: { slug: q.get('room') ?? '', active: true }, select: { id: true } });
  if (!room) return Response.json({ error: 'ROOM_NOT_FOUND' }, { status: 404 });

  // Clamp rather than reject: the calendar asks for whole months, which can
  // start before today or run past the booking window.
  const now = new Date();
  const start = Math.max(from, today(now) - 31);
  const end = Math.min(to, start + MAX_SPAN, today(now) + MAX_ADVANCE_DAYS + 1);
  const days = end > start ? await roomCalendar(room.id, start, end, now) : [];

  return Response.json({ days }, { headers: { 'Cache-Control': 'no-store' } });
}
