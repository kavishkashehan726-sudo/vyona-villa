import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdminQuote } from '@vyona/core';
import { dayOf, toIso } from '@vyona/core/dates';
import { prisma } from '@vyona/db';
import { Icon } from '@vyona/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { GuestFields } from '@/components/GuestFields';
import { requireAdmin } from '@/lib/session';
import { fullDate, longDate, money, plural, shortDate, SOURCE_LABEL, STATUS_LABEL, usd, when } from '@/lib/format';
import { cancelBooking, updateGuest, updateOwnerNotes } from '../actions';
import { MoveForm } from './MoveForm';

export async function generateMetadata({ params }: PageProps<'/reservations/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const r = await prisma.reservation.findUnique({ where: { id }, select: { ref: true, guestName: true } });
  return { title: r ? `${r.guestName} · ${r.ref}` : 'Booking' };
}

const PAYMENT_LABEL = { PENDING: 'Started, not paid', PAID: 'Paid', FAILED: 'Failed', CANCELLED: 'Abandoned', REFUNDED: 'Refunded' } as const;

export default async function ReservationPage({ params, searchParams }: PageProps<'/reservations/[id]'>) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await prisma.reservation.findUnique({
    where: { id },
    include: { room: true, payments: { orderBy: { createdAt: 'desc' } } },
  });
  if (!r) notFound();

  const now = new Date();
  const live = r.status === 'CONFIRMED' || (r.status === 'HOLD' && !!r.holdUntil && r.holdUntil > now);
  const status = r.status === 'HOLD' && !live ? 'Hold ran out' : STATUS_LABEL[r.status];
  const nights = dayOf(r.checkOut) - dayOf(r.checkIn);
  const q = r.breakdown as unknown as AdminQuote;
  const paid = r.payments.filter((p) => p.status === 'PAID');
  const paidTotal = paid.reduce((s, p) => s + p.amount, 0);
  const refund = paidTotal > 0 && (r.status === 'CANCELLED' || r.status === 'EXPIRED');
  const rooms = await prisma.room.findMany({
    where: { OR: [{ active: true }, { id: r.roomId }] },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, name: true, maxGuests: true },
  });
  const phone = r.phone?.replace(/[^\d+]/g, '');

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            <Link href="/reservations">Bookings</Link> / {r.ref}
          </p>
          <h1 className="h1">{r.guestName}</h1>
          <p className="meta">
            <span className={`chip chip--${live ? r.status.toLowerCase() : 'expired'}`}>{status}</span>
            <span>{SOURCE_LABEL[r.source]}</span>
            <span>Booked {when(r.createdAt)}</span>
          </p>
        </div>
        <Link className="btn btn--ghost btn--sm" href={`/?date=${toIso(dayOf(r.checkIn))}`}>
          See on the calendar
        </Link>
      </div>

      {sp.saved === 'created' && (
        <p className="note note--ok" role="status">
          Booking confirmed. The nights are closed on the website{r.email ? '' : '. There’s no email address, so no confirmation was sent'}.
        </p>
      )}
      {r.status === 'CANCELLED' && sp.saved?.toString().startsWith('cancelled') && (
        <p className="note note--ok" role="status">
          Cancelled. The nights are open again{sp.saved === 'cancelled-emailed' ? `, and ${r.guestName.split(' ')[0]} will get an email` : ''}.
        </p>
      )}
      {r.status === 'HOLD' && live && (
        <p className="note">
          The guest is paying now. If they don’t finish by {when(r.holdUntil!)}, the hold runs out and the nights open again.
        </p>
      )}
      {refund && (
        <p className="note note--error" role="alert">
          {money(paidTotal, paid[0]!.currency)} was paid online for this {r.status === 'EXPIRED' ? 'hold' : 'booking'}. Refund it in the
          PayHere dashboard (order {paid[0]!.orderId}).
        </p>
      )}

      <div className="detail">
        <section className="card">
          <h2 className="card__title">Stay</h2>
          <dl className="facts">
            <div>
              <dt>Room</dt>
              <dd>
                <Icon name={r.room.icon as never} className="facts__icon" /> {r.room.number} · {r.room.name}
              </dd>
            </div>
            <div>
              <dt>Arrives</dt>
              <dd>{longDate(r.checkIn)}</dd>
            </div>
            <div>
              <dt>Leaves</dt>
              <dd>{longDate(r.checkOut)}</dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>
                {plural(nights, 'night')}, {plural(r.guests, 'guest')}
              </dd>
            </div>
            {r.arrivalTime && (
              <div>
                <dt>Arriving around</dt>
                <dd>{r.arrivalTime}</dd>
              </div>
            )}
            {r.cancelledAt && (
              <div>
                <dt>Cancelled</dt>
                <dd>{when(r.cancelledAt)}</dd>
              </div>
            )}
          </dl>

          {q?.nights && (
            <details className="breakdown">
              <summary>
                <span>Total</span>
                <b>{money(r.total, r.currency)}</b>
              </summary>
              <dl className="quote__lines">
                {q.nights.map((n) => (
                  <div key={n.date}>
                    <dt>{shortDate(new Date(`${n.date}T00:00:00Z`))}</dt>
                    <dd>{usd(n.price, true)}</dd>
                  </div>
                ))}
                {q.discount > 0 && (
                  <div>
                    <dt>Long-stay discount</dt>
                    <dd>−{usd(q.discount, true)}</dd>
                  </div>
                )}
                <div>
                  <dt>Service charge</dt>
                  <dd>{usd(q.serviceCharge, true)}</dd>
                </div>
                {q.adjusted && (
                  <div>
                    <dt>Usual price</dt>
                    <dd>{usd(q.subtotal - q.discount + q.serviceCharge, true)}</dd>
                  </div>
                )}
                <div className="quote__total">
                  <dt>{q.adjusted ? 'Agreed total' : 'Total'}</dt>
                  <dd>{money(r.total, r.currency)}</dd>
                </div>
              </dl>
            </details>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">Guest</h2>
          <ul className="contact">
            {r.email ? (
              <li>
                <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Your stay at VYONA (${r.ref})`)}`}>
                  <Icon name="mail" /> {r.email}
                </a>
              </li>
            ) : (
              <li className="hint">No email address</li>
            )}
            {phone && (
              <>
                <li>
                  <a href={`tel:${phone}`}>
                    <Icon name="phone" /> {r.phone}
                  </a>
                </li>
                <li>
                  <a href={`https://wa.me/${phone.replace('+', '')}`} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" /> WhatsApp
                  </a>
                </li>
              </>
            )}
            {r.country && <li>{r.country}</li>}
          </ul>
          {r.notes && (
            <blockquote className="request">
              <p>{r.notes}</p>
            </blockquote>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">Payments</h2>
          {r.payments.length === 0 ? (
            <p className="hint">
              {r.source === 'MANUAL'
                ? 'Entered by you, so nothing was paid online.'
                : r.source === 'BOOKING_COM'
                  ? 'Paid through Booking.com.'
                  : 'Nothing paid online yet.'}
            </p>
          ) : (
            <ul className="payments">
              {r.payments.map((p) => (
                <li key={p.id}>
                  <span className={`chip chip--pay-${p.status.toLowerCase()}`}>{PAYMENT_LABEL[p.status]}</span>
                  <b>{money(p.amount, p.currency)}</b>
                  <span className="table__sub">
                    PayHere order {p.orderId}
                    {p.paymentId ? `, payment ${p.paymentId}` : ''} · {when(p.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">Your notes</h2>
          <ActionForm action={updateOwnerNotes.bind(null, r.id)} className="stack-sm">
            <label className="field">
              <span className="field__label">Only you see these</span>
              <textarea className="input" name="ownerNotes" rows={4} maxLength={2000} defaultValue={r.ownerNotes ?? ''} />
            </label>
            <div>
              <Submit className="btn btn--ghost btn--sm" busy="Saving…">
                Save notes
              </Submit>
            </div>
          </ActionForm>
        </section>
      </div>

      {r.status === 'CONFIRMED' && (
        <section className="card card--wide">
          <h2 className="card__title">Change dates or room</h2>
          <MoveForm
            id={r.id}
            rooms={rooms}
            total={r.total}
            currency={r.currency}
            initial={{ roomId: r.roomId, checkIn: toIso(dayOf(r.checkIn)), checkOut: toIso(dayOf(r.checkOut)), guests: r.guests }}
          />
        </section>
      )}

      <section className="card card--wide">
        <h2 className="card__title">Guest’s details</h2>
        <ActionForm action={updateGuest.bind(null, r.id)} className="stack-sm">
          <GuestFields guest={{ ...r, name: r.guestName }} />
          <div>
            <Submit className="btn btn--ghost btn--sm" busy="Saving…">
              Save details
            </Submit>
          </div>
        </ActionForm>
      </section>

      {live && (
        <section className="card card--wide card--danger">
          <h2 className="card__title">Cancel {r.status === 'HOLD' ? 'this hold' : 'this booking'}</h2>
          <p className="hint">
            The nights from {fullDate(r.checkIn)} open again on the website and Booking.com.
            {paidTotal > 0 && ` ${money(paidTotal, paid[0]!.currency)} was paid online; refunds are made in PayHere.`}
          </p>
          <ActionForm
            action={cancelBooking.bind(null, r.id)}
            className="stack-sm"
            confirm={`Cancel ${r.guestName}’s ${r.status === 'HOLD' ? 'hold' : 'booking'}? This can’t be undone.`}
          >
            {r.email && (
              <label className="check">
                <input type="checkbox" name="emailGuest" defaultChecked={r.status === 'CONFIRMED'} />
                <span>Email {r.guestName.split(' ')[0]} that it’s cancelled</span>
              </label>
            )}
            <div>
              <Submit className="btn btn--danger btn--sm" busy="Cancelling…">
                Cancel {r.status === 'HOLD' ? 'hold' : 'booking'}
              </Submit>
            </div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
