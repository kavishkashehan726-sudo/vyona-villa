import { externalBookingUrl } from '@vyona/core';
import { Icon } from '@vyona/ui';
import { getSettings } from '@/lib/site';
import { BookingPanel } from '../BookingPanel';

export async function Booking({ room, title = 'Choose your dates.' }: { room?: string; title?: string }) {
  // While online booking is off in the admin, guests book on the external page instead of the calendar.
  // The client asked for no mention of it and no heading here: just a centred Book now button.
  const out = externalBookingUrl(await getSettings());
  if (out) {
    return (
      <section className="booking booking--out" id="booking" aria-label="Book your stay">
        <a className="btn btn--olive magnetic reveal" href={out} target="_blank" rel="noopener" data-cursor="Book">
          Book now <Icon name="arrow" className="i" />
        </a>
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
