import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@vyona/db';
import { prisma } from '@vyona/db';
import { toDate, today } from '@vyona/core/dates';
import { requireAdmin } from '@/lib/session';
import { money, plural, SOURCE_LABEL, STATUS_LABEL, stayRange, when } from '@/lib/format';

export const metadata: Metadata = { title: 'Bookings' };

const PER_PAGE = 50;

const VIEWS = {
  upcoming: 'Upcoming',
  arriving: 'Arriving today',
  'in-house': 'In house',
  leaving: 'Leaving today',
  awaiting: 'Awaiting payment',
  refunds: 'To refund',
  cancelled: 'Cancelled',
  past: 'Past',
  all: 'All',
} as const;
type View = keyof typeof VIEWS;

const SOURCES = ['DIRECT', 'BOOKING_COM', 'MANUAL'] as const;

function viewWhere(view: View, t: Date, now: Date): Prisma.ReservationWhereInput {
  const confirmed = { status: 'CONFIRMED' } as const;
  switch (view) {
    case 'upcoming':
      return { OR: [{ ...confirmed, checkOut: { gte: t } }, { status: 'HOLD', holdUntil: { gt: now } }] };
    case 'arriving':
      return { ...confirmed, checkIn: t };
    case 'in-house':
      return { ...confirmed, checkIn: { lte: t }, checkOut: { gt: t } };
    case 'leaving':
      return { ...confirmed, checkOut: t };
    case 'awaiting':
      return { status: 'HOLD', holdUntil: { gt: now } };
    case 'refunds':
      return { status: { in: ['CANCELLED', 'EXPIRED'] }, payments: { some: { status: 'PAID' } } };
    case 'cancelled':
      return { status: 'CANCELLED' };
    case 'past':
      return { ...confirmed, checkOut: { lt: t } };
    case 'all':
      return {};
  }
}

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim() : '');

export default async function ReservationsPage({ searchParams }: PageProps<'/reservations'>) {
  await requireAdmin();
  const sp = await searchParams;
  const now = new Date();
  const t = toDate(today(now));

  const view: View = one(sp.view) in VIEWS ? (one(sp.view) as View) : 'upcoming';
  const q = one(sp.q).slice(0, 100);
  const roomId = one(sp.room);
  const source = SOURCES.find((s) => s === one(sp.source));
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  const where: Prisma.ReservationWhereInput = {
    AND: [
      viewWhere(view, t, now),
      roomId ? { roomId } : {},
      source ? { source } : {},
      q
        ? {
            OR: [
              { ref: { contains: q, mode: 'insensitive' } },
              { guestName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q.replace(/\s+/g, '') } },
              { phone: { contains: q } },
            ],
          }
        : {},
    ],
  };
  // Upcoming reads like a diary; everything else newest first.
  const orderBy: Prisma.ReservationOrderByWithRelationInput[] =
    view === 'upcoming' || view === 'arriving' || view === 'in-house' || view === 'leaving'
      ? [{ checkIn: 'asc' }, { createdAt: 'asc' }]
      : view === 'past'
        ? [{ checkIn: 'desc' }]
        : [{ createdAt: 'desc' }];

  const [rows, count, rooms] = await Promise.all([
    prisma.reservation.findMany({
      where,
      orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { room: { select: { name: true, number: true } }, payments: { where: { status: 'PAID' }, select: { amount: true, currency: true } } },
    }),
    prisma.reservation.count({ where }),
    prisma.room.findMany({ orderBy: { number: 'asc' }, select: { id: true, name: true, number: true } }),
  ]);

  const pages = Math.max(1, Math.ceil(count / PER_PAGE));
  const link = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const all = { view, q, room: roomId, source, page, ...over };
    for (const [k, v] of Object.entries(all)) {
      if (v === undefined || v === '' || (k === 'view' && v === 'upcoming') || (k === 'page' && v === 1)) continue;
      params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `/reservations?${s}` : '/reservations';
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Bookings</p>
          <h1 className="h1">{VIEWS[view]}</h1>
        </div>
        <Link className="btn btn--olive" href="/reservations/new">
          New booking
        </Link>
      </div>

      <nav className="tabs" aria-label="Show">
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link key={v} href={link({ view: v, page: 1 })} aria-current={v === view ? 'page' : undefined}>
            {VIEWS[v]}
          </Link>
        ))}
      </nav>

      <form className="filters" role="search" action="/reservations">
        {view !== 'upcoming' && <input type="hidden" name="view" value={view} />}
        <label className="field filters__q">
          <span className="field__label">Search</span>
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Reference, name, email or phone" />
        </label>
        <label className="field">
          <span className="field__label">Room</span>
          <select className="input" name="room" defaultValue={roomId}>
            <option value="">All rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} · {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Booked via</span>
          <select className="input" name="source" defaultValue={source ?? ''}>
            <option value="">Anywhere</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--ghost">Show</button>
      </form>

      {rows.length === 0 ? (
        <div className="empty">
          <p>{q || roomId || source ? 'No bookings match. Try fewer filters, or the All tab.' : `Nothing under ${VIEWS[view]} right now.`}</p>
          {view === 'upcoming' && !q && (
            <Link className="btn btn--olive btn--sm" href="/reservations/new">
              Enter a booking
            </Link>
          )}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Guest</th>
              <th scope="col">Stay</th>
              <th scope="col">Room</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const paid = r.payments.reduce((s, p) => s + p.amount, 0);
              const live = r.status !== 'HOLD' || (r.holdUntil && r.holdUntil > now);
              return (
                <tr key={r.id}>
                  <td data-label="Guest">
                    <Link className="table__main" href={`/reservations/${r.id}`}>
                      {r.guestName}
                    </Link>
                    <span className="table__sub">
                      {r.ref} · {SOURCE_LABEL[r.source]} · booked {when(r.createdAt)}
                    </span>
                  </td>
                  <td data-label="Stay">
                    {stayRange(r.checkIn, r.checkOut)}
                    <span className="table__sub">
                      {plural(Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 86_400_000), 'night')}, {plural(r.guests, 'guest')}
                    </span>
                  </td>
                  <td data-label="Room">
                    {r.room.number} · {r.room.name}
                  </td>
                  <td data-label="Status">
                    <span className={`chip chip--${live ? r.status.toLowerCase() : 'expired'}`}>{live ? STATUS_LABEL[r.status] : 'Hold ran out'}</span>
                    {paid > 0 && r.status !== 'CONFIRMED' && <span className="chip chip--refund">Paid, refund</span>}
                  </td>
                  <td data-label="Total" className="num">
                    {money(r.total, r.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {pages > 1 && (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={link({ page: page - 1 })}>← Previous</Link> : <span />}
          <span>
            Page {page} of {pages} · {plural(count, 'booking')}
          </span>
          {page < pages ? <Link href={link({ page: page + 1 })}>Next →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
