import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dayOf, nightsOf } from '@vyona/core/dates';
import { prisma } from '@vyona/db';
import { Icon, Mark } from '@vyona/ui';
import { PaymentStatus } from '@/components/PaymentStatus';
import { Price } from '@/components/Price';
import { getSettings } from '@/lib/site';

// Booking references are not secrets, so the page shows no guest name or email.
// PayHere sends the guest back here with ?payment=done or ?payment=cancelled.
export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } };

const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' });

/** The booking total, in the visitor's display currency. */
const total = (cents: number, currency: string) =>
  currency === 'USD' ? <Price cents={cents} exact /> : charged(cents, currency);

/** What was (or will be) charged, always in the currency of the charge. */
const charged = (cents: number, currency: string) =>
  currency === 'USD'
    ? `US$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : `${currency} ${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default async function BookingRefPage({ params, searchParams }: PageProps<'/book/[ref]'>) {
  const [{ ref }, query, settings] = await Promise.all([params, searchParams, getSettings()]);
  const r = await prisma.reservation.findUnique({
    where: { ref: ref.toUpperCase() },
    select: {
      ref: true,
      status: true,
      holdUntil: true,
      checkIn: true,
      checkOut: true,
      guests: true,
      total: true,
      currency: true,
      room: { select: { name: true, element: true, slug: true } },
      payments: { orderBy: { createdAt: 'desc' }, select: { provider: true, status: true, amount: true, currency: true } },
    },
  });
  if (!r) notFound();
  const nights = nightsOf(dayOf(r.checkIn), dayOf(r.checkOut)).length;
  const paid = r.payments.find((p) => p.status === 'PAID');
  const atVilla = r.payments.find((p) => p.provider === 'VILLA');
  const latest = r.payments[0];
  const returned = query.payment === 'done' ? 'done' : query.payment === 'cancelled' ? 'cancelled' : null;

  // A hold whose deadline passed is expired even before the worker sweeps it.
  const live = r.status === 'HOLD' && r.holdUntil !== null && r.holdUntil > new Date();
  const status = r.status === 'HOLD' && !live ? 'EXPIRED' : r.status;
  const declined = latest && (latest.status === 'CANCELLED' || latest.status === 'FAILED');
  const waiting = live && returned === 'done' && !declined;

  return (
    <>
      <div className="page-top" />
      <section className="ref" aria-labelledby="ref-title">
        {status === 'CONFIRMED' && (
          <>
            <Mark className="ref__mark" />
            <p className="ref__status">Confirmed</p>
            <h1 className="h2" id="ref-title">
              See you in Weligama.
            </h1>
            <p className="ref__lead">
              Booking <strong>{r.ref}</strong>. We&rsquo;ve emailed your confirmation.{' '}
              {paid
                ? <>Paid by card: {charged(paid.amount, paid.currency)}.</>
                : atVilla
                  ? <>You&rsquo;ll pay {charged(atVilla.amount, atVilla.currency)} at the villa on arrival.</>
                  : null}
            </p>
          </>
        )}

        {status === 'HOLD' && (
          <>
            <p className="ref__status">{waiting ? 'Payment in progress' : 'Held, awaiting payment'}</p>
            <h1 className="h2" id="ref-title">
              Booking {r.ref}
            </h1>
            <p className="ref__lead">
              {declined || returned === 'cancelled'
                ? 'The payment didn’t go through, so nothing was charged. '
                : ''}
              We&rsquo;re holding the room for you until {timeFmt.format(r.holdUntil!)} (Sri Lanka time).
            </p>
            <PaymentStatus bookingRef={r.ref} waiting={waiting} canRetry={!waiting} />
          </>
        )}

        {status === 'EXPIRED' && (
          <>
            <p className="ref__status">Hold expired</p>
            <h1 className="h2" id="ref-title">
              Booking {r.ref}
            </h1>
            <p className="ref__lead">
              {paid
                ? 'Your payment arrived after the hold ran out and the room had been taken. We’ll refund it in full and be in touch by email.'
                : 'This hold ran out before it was paid, so the dates were released. They may still be free.'}
            </p>
            {!paid && (
              <p className="mock-pay">
                <Link className="btn btn--olive magnetic" href={`/book?room=${r.room.slug}`} data-open-booking data-room={r.room.slug}>
                  Choose dates again
                </Link>
              </p>
            )}
          </>
        )}

        {status === 'CANCELLED' && (
          <>
            <p className="ref__status">Cancelled</p>
            <h1 className="h2" id="ref-title">
              Booking {r.ref}
            </h1>
            <p className="ref__lead">This booking has been cancelled. Questions? Reply to your confirmation email.</p>
          </>
        )}

        <dl className="bk__summary">
          <dt>Room</dt>
          <dd>
            <Link href={`/stay/${r.room.slug}`}>
              {r.room.name}, the {r.room.element} room
            </Link>
          </dd>
          <dt>Check-in</dt>
          <dd>
            {dateFmt.format(r.checkIn)}, from {settings.checkInTime}
          </dd>
          <dt>Check-out</dt>
          <dd>
            {dateFmt.format(r.checkOut)}, by {settings.checkOutTime}
          </dd>
          <dt>Nights</dt>
          <dd>{nights}</dd>
          <dt>Guests</dt>
          <dd>{r.guests}</dd>
          <dt className="bk__total">Total</dt>
          <dd className="bk__total">{total(r.total, r.currency)}</dd>
        </dl>
        <p style={{ marginTop: '2.4rem' }}>
          <Link className="link-caps" href="/">
            Back to VYONA <Icon name="arrow" className="i" />
          </Link>
        </p>
      </section>
    </>
  );
}
