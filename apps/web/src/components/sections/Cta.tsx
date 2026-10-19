import Link from 'next/link';
import { externalBookingUrl } from '@vyona/core';
import { Icon, Mark, Palm } from '@vyona/ui';
import { getSettings } from '@/lib/site';
import { Photo } from '../Photo';

export async function Cta() {
  const out = externalBookingUrl(await getSettings());
  return (
    <section className="cta" aria-labelledby="cta-title">
      <Palm className="cta__palm" />
      <div className="cta__text reveal">
        <h2 className="h2" id="cta-title">
          Your stay at VYONA
        </h2>
        <p>
          {out ? (
            <>
              Check availability and book your stay
              <br />
              on Booking.com.
            </>
          ) : (
            <>
              Check availability and book your stay directly
              <br />
              for the best rates.
            </>
          )}
        </p>
        <Link className="btn btn--olive magnetic" href="/book" data-open-booking data-cursor="Book">
          Book now <Icon name="arrow" className="i" />
        </Link>
      </div>
      <figure className="cta__img">
        <Photo k="room-linen" alt="" />
        <Mark className="cta__mark" />
      </figure>
    </section>
  );
}
