import Link from 'next/link';
import { Icon, Mark, Palm } from '@vyona/ui';
import { Photo } from '../Photo';

export function Cta() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <Palm className="cta__palm" />
      <div className="cta__text reveal">
        <h2 className="h2" id="cta-title">
          Your stay at VYONA
        </h2>
        <p>
          Check availability and book your stay directly
          <br />
          for the best rates.
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
