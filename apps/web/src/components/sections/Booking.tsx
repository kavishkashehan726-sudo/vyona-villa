import { externalBookingUrl } from '@vyona/core';
import { Icon } from '@vyona/ui';
import { getSettings } from '@/lib/site';
import { BookingPanel } from '../BookingPanel';

export async function Booking({ room, title = 'Choose your dates.' }: { room?: string; title?: string }) {
  // While online booking is off in the admin, guests book on Booking.com instead of the calendar.
  const out = externalBookingUrl(await getSettings());
  if (out) {
    return (
      <section className="booking booking--out" id="booking" aria-labelledby="booking-title">
        <div className="booking__intro reveal">
          <p className="eyebrow">Book your stay</p>
          <h2 className="h2" id="booking-title">
            {title}
          </h2>
          <p>We take bookings through Booking.com. Choose your room and dates there, and we&rsquo;ll look after the rest.</p>
          <a className="btn btn--olive magnetic" href={out} target="_blank" rel="noopener" data-cursor="Book">
            Book on Booking.com <Icon name="arrow" className="i" />
          </a>
        </div>
      </section>
    );
  }
  return (
    <section className="booking" id="booking" aria-labelledby="booking-title">
      <div className="booking__intro reveal">
        <p className="eyebrow">Book direct</p>
        <h2 className="h2" id="booking-title">
          {title}
        </h2>
        <p>
          Pick a room, then your check-in and check-out days. The total updates as you go. Booking direct always gets
          the best rate.
        </p>
        <ul className="legend" aria-label="Calendar key">
          <li>
            <span className="legend__sw legend__sw--free" />
            Available
          </li>
          <li>
            <span className="legend__sw legend__sw--reserved" />
            On hold
          </li>
          <li>
            <span className="legend__sw legend__sw--booked" />
            Booked
          </li>
        </ul>
      </div>
      <BookingPanel room={room} />
    </section>
  );
}
