// The seven room cards. Each opens the room dialog; the photo carries the
// liquid-hover ripple.

import Link from 'next/link';
import { Icon, type IconName } from '@vyona/ui';
import type { RoomData } from '@/lib/site';
import { Photo } from '../Photo';
import { Price } from '../Price';

export function RoomCards({ rooms }: { rooms: RoomData[] }) {
  return (
    <ul className="rooms__grid" data-rooms>
      {rooms.map((r) => (
        <li className="room-card reveal" key={r.slug}>
          <button
            type="button"
            className="room-card__btn"
            data-room-open={r.slug}
            data-cursor="Open"
            aria-label={`${r.name}, room ${r.number}. See details`}
          >
            <span className="room-card__img ripple-host">
              <Photo k={r.photos[0] ?? ''} className="ripple" alt={`${r.name} room at VYONA`} />
            </span>
            <Icon name={r.icon as IconName} className="room-card__icon" />
            <span className="room-card__name">{r.name.toUpperCase()}</span>
            <span className="room-card__meaning">{r.number}</span>
            <span className="room-card__price">
              From <Price cents={r.baseRate} /> / night
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Rooms({ rooms }: { rooms: RoomData[] }) {
  return (
    <section className="rooms" id="rooms">
      <div className="section-head reveal">
        <div>
          <p className="eyebrow">Stay</p>
          <h2 className="h2">Seven rooms. Each with a nature of its own.</h2>
          <p className="section-head__lede">
            Two spacious studios and five king rooms, surrounded by tropical greenery and overlooking the pool, rice
            fields and landscape beyond.
          </p>
        </div>
        <Link className="link-caps" href="/stay">
          See all rooms <Icon name="arrow" className="i" />
        </Link>
      </div>
      <RoomCards rooms={rooms} />
      <p className="proto-note">Room-to-photo pairings are placeholders for the client to confirm.</p>
    </section>
  );
}
