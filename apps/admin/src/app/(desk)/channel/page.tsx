import type { Metadata } from 'next';
import Link from 'next/link';
import { beds24Mock, beds24Mode, POLLED_AT, type Beds24Booking } from '@vyona/core';
import { today, toIso } from '@vyona/core/dates';
import { prisma } from '@vyona/db';
import { Icon, type IconName } from '@vyona/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { requireAdmin } from '@/lib/session';
import { stayRange, when } from '@/lib/format';
import { cancelOnBookingCom, linkRooms, sellOnBookingCom, syncNow } from './actions';

export const metadata: Metadata = { title: 'Booking.com' };

const KIND: Record<string, string> = {
  'ari.push': 'Prices and closed nights sent',
  'booking.create': 'Booking sent',
  'booking.update': 'Booking change sent',
  'booking.cancel': 'Cancellation sent',
  'booking.fetch': 'Booking fetched',
  'booking.import': 'Booking.com booking received',
  poll: 'Checked for changes',
};

const STATUS: Record<string, [label: string, chip: string]> = {
  ok: ['Done', 'confirmed'],
  conflict: ['Overbooked', 'refund'],
  missing: ['Not found', 'expired'],
  error: ['Failed', 'expired'],
};

const MODE = {
  beds24: 'Connected to Beds24. Prices and closed nights go out within a minute of a change, and Booking.com bookings arrive the same way.',
  mock: 'Test mode: there is no Beds24 account yet, so this talks to a stand-in. Everything below works, and nothing reaches Booking.com.',
  off: 'Off. Booking.com sync starts once the Beds24 key is added on the server.',
};

export default async function ChannelPage() {
  await requireAdmin();
  const mode = beds24Mode();
  const now = new Date();
  const day = 86_400_000;

  const [rooms, polled, problems, log] = await Promise.all([
    prisma.room.findMany({ orderBy: { number: 'asc' }, select: { id: true, name: true, number: true, icon: true, active: true, beds24RoomId: true } }),
    prisma.setting.findUnique({ where: { key: POLLED_AT } }),
    prisma.syncLog.count({ where: { status: { in: ['error', 'conflict'] }, createdAt: { gt: new Date(now.getTime() - day) } } }),
    prisma.syncLog.findMany({
      // Quiet runs of the 10-minute check would bury everything else.
      where: { NOT: { status: 'ok', kind: { in: ['poll', 'booking.fetch'] } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ]);
  const linked = rooms.filter((r) => r.beds24RoomId !== null);
  const polledAt = typeof polled?.value === 'string' ? new Date(polled.value) : null;

  // Test mode: the stand-in's own bookings, and which of ours each one became.
  let sales: (Beds24Booking & { ours?: { id: string; ref: string } })[] = [];
  if (mode === 'mock') {
    const all = (await beds24Mock().bookings()).filter((b) => b.channel === 'booking').reverse().slice(0, 20);
    const ours = await prisma.reservation.findMany({
      where: { externalId: { in: all.map((b) => String(b.id)) } },
      select: { id: true, ref: true, externalId: true },
    });
    sales = all.map((b) => ({ ...b, ours: ours.find((r) => r.externalId === String(b.id)) }));
  }
  const roomOf = (beds24Id: number) => linked.find((r) => r.beds24RoomId === beds24Id);
  const first = today(now) + 21;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vyonaweligama.com';

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Booking.com</p>
          <h1 className="h1">
            One calendar, <em>two doors</em>
          </h1>
          <p className="lede">
            Beds24 sits between this calendar and Booking.com. Your prices, minimum stays and closed nights go out to it, website bookings
            close their nights there, and Booking.com bookings come back onto the calendar here.
          </p>
        </div>
      </div>

      <div className="detail">
        <section className="card">
          <h2 className="card__title">Sync</h2>
          <p className={`note ${mode === 'off' ? 'note--error' : 'note--ok'}`}>{MODE[mode]}</p>
          <dl className="facts">
            <div>
              <dt>Rooms linked</dt>
              <dd>
                {linked.length} of {rooms.length}
              </dd>
            </div>
            <div>
              <dt>Last full check</dt>
              <dd>{polledAt ? when(polledAt) : 'Not yet'}</dd>
            </div>
            <div>
              <dt>Problems, 24 h</dt>
              <dd>{problems === 0 ? 'None' : <span className="chip chip--refund">{problems}</span>}</dd>
            </div>
          </dl>
          {mode !== 'off' && (
            <ActionForm action={syncNow} className="actions">
              <Submit className="btn btn--ghost btn--sm" name="what" value="bookings" busy="Starting…">
                Check for bookings
              </Submit>
              <Submit className="btn btn--ghost btn--sm" name="what" value="prices" busy="Starting…">
                Send prices now
              </Submit>
            </ActionForm>
          )}
          <p className="hint">
            Everything also runs on its own: a check for bookings every 10 minutes and the full year of prices every night at 03:30.
          </p>
        </section>

        <section className="card">
          <h2 className="card__title">Rooms in Beds24</h2>
          <p className="hint">
            Each room’s id is in Beds24 under Settings → Properties → Rooms. Leave it blank to keep a room off Booking.com.
          </p>
          <ActionForm action={linkRooms} className="stack-sm">
            <ul className="rates">
              {rooms.map((room) => (
                <li key={room.id}>
                  <label className="rates__row" htmlFor={`b24-${room.id}`}>
                    <Icon name={room.icon as IconName} className="rates__icon" />
                    <span className="rates__name">
                      <b>{room.number}</b> {room.name}
                      {!room.active && <span className="table__sub">Off the website, so closed on Booking.com</span>}
                    </span>
                  </label>
                  <input
                    id={`b24-${room.id}`}
                    className="input input--sm"
                    name={`b24:${room.id}`}
                    inputMode="numeric"
                    defaultValue={room.beds24RoomId ?? ''}
                    placeholder="Not linked"
                  />
                </li>
              ))}
            </ul>
            <div>
              <Submit busy="Saving…">Save rooms</Submit>
            </div>
          </ActionForm>
          {mode === 'beds24' && (
            <p className="hint">
              In Beds24, set the booking webhook to <code>{site}/api/webhooks/beds24?key=…</code> with the webhook key from the server, so
              bookings arrive in seconds instead of at the next check.
            </p>
          )}
        </section>
      </div>

      {mode === 'mock' && (
        <section className="card card--wide">
          <h2 className="card__title">Try it: be a Booking.com guest</h2>
          <p className="hint">
            Books a linked room in the stand-in as a Booking.com guest would. It lands on the calendar like a real one. It won’t sell nights
            that are closed or taken unless you tick the box, which is how an overbooking looks.
          </p>
          {linked.length === 0 ? (
            <p className="hint">Link a room above first, with any number.</p>
          ) : (
            <ActionForm action={sellOnBookingCom} className="form-grid">
              <label className="field">
                <span className="field__label">Room</span>
                <select className="input" name="roomId" defaultValue={linked[0]!.beds24RoomId!}>
                  {linked.map((r) => (
                    <option key={r.id} value={r.beds24RoomId!}>
                      {r.number} · {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Guest</span>
                <input className="input" name="name" defaultValue="Anna Berg" maxLength={80} required />
              </label>
              <label className="field">
                <span className="field__label">Arrives</span>
                <input className="input" type="date" name="arrival" defaultValue={toIso(first)} required />
              </label>
              <label className="field">
                <span className="field__label">Leaves</span>
                <input className="input" type="date" name="departure" defaultValue={toIso(first + 3)} required />
              </label>
              <label className="check form-grid__wide">
                <input type="checkbox" name="force" />
                <span>
                  Sell it even if the nights are closed or booked
                  <span className="field__hint">The booking is still recorded, and you get an “Overbooked” email.</span>
                </span>
              </label>
              <div className="form-grid__wide">
                <Submit busy="Booking…">Book on Booking.com</Submit>
              </div>
            </ActionForm>
          )}

          {sales.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Stay</th>
                  <th scope="col">Room</th>
                  <th scope="col">Here</th>
                  <th scope="col">
                    <span className="hint">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sales.map((b) => {
                  const room = roomOf(b.roomId);
                  return (
                    <tr key={b.id}>
                      <td data-label="Guest">
                        <span className="table__main">
                          {b.firstName} {b.lastName}
                        </span>
                        <span className="table__sub">Beds24 {b.id}</span>
                      </td>
                      <td data-label="Stay">{stayRange(new Date(b.arrival), new Date(b.departure))}</td>
                      <td data-label="Room">{room ? `${room.number} · ${room.name}` : `Beds24 room ${b.roomId}`}</td>
                      <td data-label="Here">
                        {b.status === 'cancelled' ? (
                          <span className="chip chip--cancelled">Cancelled</span>
                        ) : b.ours ? (
                          <Link href={`/reservations/${b.ours.id}`}>{b.ours.ref}</Link>
                        ) : (
                          <span className="table__sub">Arriving…</span>
                        )}
                      </td>
                      <td data-label="Action">
                        {b.status !== 'cancelled' && (
                          <form action={cancelOnBookingCom.bind(null, b.id)}>
                            <button className="btn btn--text btn--sm">Guest cancels</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="card card--wide">
        <h2 className="card__title">Activity</h2>
        {log.length === 0 ? (
          <p className="hint">Nothing yet. Link a room to send its prices.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Booking</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => {
                const [label, chip] = STATUS[e.status] ?? [e.status, 'expired'];
                const ours = e.ref && /^[A-Z]/.test(e.ref);
                return (
                  <tr key={e.id}>
                    <td data-label="When">{when(e.createdAt)}</td>
                    <td data-label="What">
                      {KIND[e.kind] ?? e.kind}
                      {e.error && <span className="table__sub">{e.error}</span>}
                    </td>
                    <td data-label="Booking">
                      {!e.ref ? '—' : ours ? <Link href={`/reservations?view=all&q=${encodeURIComponent(e.ref)}`}>{e.ref}</Link> : `Beds24 ${e.ref}`}
                    </td>
                    <td data-label="Result">
                      <span className={`chip chip--${chip}`}>{label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
