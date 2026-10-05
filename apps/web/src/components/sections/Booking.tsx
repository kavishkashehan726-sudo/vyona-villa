import { BookingPanel } from '../BookingPanel';

export function Booking({ room, title = 'Choose your dates.' }: { room?: string; title?: string }) {
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
