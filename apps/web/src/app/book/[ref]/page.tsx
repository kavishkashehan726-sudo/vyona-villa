import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dayOf, nightsOf } from '@vyona/core/dates';
import { prisma } from '@vyona/db';
import { Icon } from '@vyona/ui';
import { Price } from '@/components/Price';

// Booking references are not secrets, so the page shows no guest name or email.
export const metadata: Metadata = { title: 'Your booking', robots: { index: false, follow: false } };

const STATUS = {
  HOLD: 'Held, awaiting payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Hold expired',
} as const;

const dateFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function BookingRefPage({ params }: PageProps<'/book/[ref]'>) {
  const { ref } = await params;
  const r = await prisma.reservation.findUnique({
    where: { ref: ref.toUpperCase() },
    select: {
      ref: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guests: true,
      total: true,
      currency: true,
      room: { select: { name: true, element: true, slug: true } },
    },
  });
  if (!r) notFound();
  const nights = nightsOf(dayOf(r.checkIn), dayOf(r.checkOut)).length;

  return (
    <>
      <div className="page-top" />
      <section className="ref" aria-labelledby="ref-title">
      <p className="ref__status">{STATUS[r.status]}</p>
      <h1 className="h2" id="ref-title">
        Booking {r.ref}
      </h1>
      <dl className="bk__summary">
        <dt>Room</dt>
        <dd>
          <Link href={`/stay/${r.room.slug}`}>
            {r.room.name}, the {r.room.element} room
          </Link>
        </dd>
        <dt>Check-in</dt>
        <dd>{dateFmt.format(r.checkIn)}</dd>
        <dt>Check-out</dt>
        <dd>{dateFmt.format(r.checkOut)}</dd>
        <dt>Nights</dt>
        <dd>{nights}</dd>
        <dt>Guests</dt>
        <dd>{r.guests}</dd>
        <dt className="bk__total">Total</dt>
        <dd className="bk__total">
          {r.currency === 'USD' ? <Price cents={r.total} /> : `${r.currency} ${(r.total / 100).toLocaleString('en-GB')}`}
        </dd>
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
