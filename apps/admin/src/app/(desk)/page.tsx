import type { Metadata } from 'next';
import Link from 'next/link';
import { adminGrid } from '@vyona/core';
import { parseDay, toDate, toIso, today } from '@vyona/core/dates';
import { prisma } from '@vyona/db';
import { Chart } from '@/components/Chart';
import { JumpTo } from '@/components/JumpTo';
import { requireAdmin } from '@/lib/session';
import { longDate, plural } from '@/lib/format';

export const metadata: Metadata = { title: 'Calendar' };

const DAYS = 42;
const STEP = 28;
const LEAD = 3; // nights shown before the chosen date

const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function CalendarPage({ searchParams }: PageProps<'/'>) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const t = today(now);
  const date = (typeof sp.date === 'string' && parseDay(sp.date)) || t;
  const from = date - LEAD;

  const [rooms, stats] = await Promise.all([adminGrid(from, DAYS, now), todayStats(t, now)]);
  const first = monthYear.format(toDate(from + LEAD));
  const last = monthYear.format(toDate(from + DAYS - 1));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 className="h1">{first === last ? first : `${first.split(' ')[0]} – ${last}`}</h1>
        </div>
        <div className="toolbar" role="group" aria-label="Move through the calendar">
          <Link className="btn btn--ghost btn--sm" href={`/?date=${toIso(date - STEP)}`} aria-label="Four weeks earlier">
            ← 4 weeks
          </Link>
          <Link className="btn btn--ghost btn--sm" href="/" aria-current={date === t ? 'page' : undefined}>
            Today
          </Link>
          <Link className="btn btn--ghost btn--sm" href={`/?date=${toIso(date + STEP)}`} aria-label="Four weeks later">
            4 weeks →
          </Link>
          <JumpTo value={toIso(date)} />
        </div>
      </div>

      <TodayLine t={t} {...stats} />

      <Chart rooms={rooms} from={from} days={DAYS} today={t} />

      <ul className="legend" aria-label="Key">
        <li><i className="legend__bar" /> Confirmed</li>
        <li><i className="legend__bar legend__bar--manual" /> Entered by you</li>
        <li><i className="legend__bar legend__bar--channel" /> Booking.com</li>
        <li><i className="legend__bar legend__bar--hold" /> Awaiting payment</li>
        <li><i className="legend__closed" /> Closed to guests</li>
        <li><i className="legend__custom" /> Your price</li>
        <li><b className="legend__min">3+</b> Minimum stay from that night</li>
      </ul>
      <p className="hint">
        Drag across nights, or tap one night and then another, to close them, open them, or set a price or minimum stay.
        Shift-click extends a selection. Click a booking to open it.
      </p>
    </>
  );
}

async function todayStats(t: number, now: Date) {
  const day = toDate(t);
  const confirmed = { status: 'CONFIRMED' } as const;
  const [arriving, leaving, inHouse, awaiting, rooms, booked, refunds] = await Promise.all([
    prisma.reservation.count({ where: { ...confirmed, checkIn: day } }),
    prisma.reservation.count({ where: { ...confirmed, checkOut: day } }),
    prisma.reservation.count({ where: { ...confirmed, checkIn: { lte: day }, checkOut: { gt: day } } }),
    prisma.reservation.count({ where: { status: 'HOLD', holdUntil: { gt: now } } }),
    prisma.room.count({ where: { active: true } }),
    prisma.roomDay.count({
      where: { date: { gte: day, lt: toDate(t + 30) }, room: { active: true }, reservation: confirmed },
    }),
    prisma.payment.count({ where: { status: 'PAID', reservation: { status: { in: ['CANCELLED', 'EXPIRED'] } } } }),
  ]);
  return { arriving, leaving, inHouse, awaiting, occupancy: rooms ? Math.round((booked / (rooms * 30)) * 100) : 0, refunds };
}

function TodayLine(p: { t: number } & Awaited<ReturnType<typeof todayStats>>) {
  return (
    <div className="today">
      <p className="today__date">{longDate(p.t)}</p>
      <ul className="today__list">
        <li><Link href="/reservations?view=arriving">{plural(p.arriving, 'arrival')}</Link></li>
        <li><Link href="/reservations?view=leaving">{plural(p.leaving, 'departure')}</Link></li>
        <li><Link href="/reservations?view=in-house">{p.inHouse} in house</Link></li>
        <li><Link href="/reservations?view=awaiting">{p.awaiting} awaiting payment</Link></li>
        <li>Next 30 nights {p.occupancy}% booked</li>
      </ul>
      {p.refunds > 0 && (
        <Link className="today__alert" href="/reservations?view=refunds">
          {plural(p.refunds, 'payment')} to refund
        </Link>
      )}
    </div>
  );
}
