// Stay: copy word for word from the client's "STAY - rooms content".

import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, Palm, type IconName } from '@vyona/ui';
import { PageEffects } from '@/components/PageEffects';
import { Photo } from '@/components/Photo';
import { Price } from '@/components/Price';
import { Cta } from '@/components/sections/Cta';
import { PageHero } from '@/components/sections/Hero';
import { EVERY_ROOM, SHOW_DRAFT_PAGES } from '@/lib/content';
import { getRooms, roomSpecs, roomTitle } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Stay',
  description:
    'Seven rooms, each with a nature of its own: two spacious studios and five king rooms among the palms in Weligama, Sri Lanka.',
  alternates: { canonical: '/stay' },
};

export default async function StayPage() {
  const rooms = await getRooms();
  return (
    <>
      <PageHero photo="room-wide" eyebrow="Stay" lines={['Seven rooms.', 'Each with a nature', 'of its own.']} />

      <div className="stay-intro reveal">
        <p>
          Two spacious studios and five king rooms, surrounded by tropical greenery and overlooking the pool, rice
          fields and landscape beyond.
        </p>
        <Link className="link-caps" href="/book" data-open-booking>
          Check availability <Icon name="arrow" className="i" />
        </Link>
        <hr className="rule" style={{ margin: '3rem auto 1.4rem' }} />
        <h2 className="eyebrow">The rooms</h2>
      </div>

      <ol className="stay-rooms">
        {rooms.map((r) => (
          <li className="stay-room" key={r.slug} id={r.slug}>
            <Link className="stay-room__media unveil ripple-host" href={`/stay/${r.slug}`} data-cursor="Open" tabIndex={-1} aria-hidden="true">
              <Photo k={r.photos[0] ?? ''} className="ripple" alt="" />
            </Link>
            <div className="stay-room__body reveal">
              <Icon name={r.icon as IconName} className="stay-room__icon" />
              <h3 className="stay-room__name">
                <Link href={`/stay/${r.slug}`}>{roomTitle(r)}</Link>
              </h3>
              <p className="stay-room__element">{r.element}</p>
              {r.keywords.length > 0 && <p className="stay-room__keywords">{r.keywords.join(' · ')}</p>}
              <p className="stay-room__specs">{roomSpecs(r)}</p>
              <ul className="stay-room__features">
                {r.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="stay-room__price">
                <small>From</small>
                <Price cents={r.baseRate} />
              </p>
              <div className="stay-room__actions">
                <Link
                  className="btn btn--olive btn--sm magnetic"
                  href={`/book?room=${r.slug}`}
                  data-open-booking
                  data-room={r.slug}
                  data-cursor="Book"
                >
                  Check dates
                </Link>
                <Link className="link-caps" href={`/stay/${r.slug}`}>
                  Room details <Icon name="arrow" className="i" />
                </Link>
              </div>
              {r.keywords.length === 0 && <p className="proto-note">Keywords for {r.name} to come from the client.</p>}
            </div>
          </li>
        ))}
      </ol>

      <p className="stay-note reveal">
        All rooms have a king-size bed, ensuite bathroom, air conditioning, ceiling fan, complimentary Wi-Fi, tea and
        coffee, and access to outdoor space.
      </p>

      <section className="every" aria-labelledby="every-title">
        <div className="every__inner reveal">
          <p className="eyebrow">Comfort, as standard</p>
          <h2 className="h2" id="every-title">
            In every room
          </h2>
          <ul className="every__list">
            {EVERY_ROOM.map((item) => (
              <li key={item}>
                <Icon name="leaf" className="i" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="more" aria-labelledby="more-title">
        <Palm className="more__palm" />
        <div className="more__text reveal">
          <p className="eyebrow">A room, and a little more</p>
          <h2 className="h2" id="more-title">
            Whichever room you choose, all of VYONA is yours to enjoy.
          </h2>
          <hr className="rule rule--light" />
          <p>Swim beneath the palms. Have breakfast in the garden. Find a quiet corner with a book. Stay for another coffee.</p>
          <p>Weligama is just down the road when you want it.</p>
          <p>And when you don&rsquo;t, that&rsquo;s rather the point.</p>
          {SHOW_DRAFT_PAGES && (
            <Link className="link-caps" href="/explore/vyona">
              Discover VYONA <Icon name="arrow" className="i" />
            </Link>
          )}
        </div>
        <div className="more__img">
          <span data-parallax="0.12">
            <Photo k="garden-pool" alt="The garden path down to the pool" />
          </span>
        </div>
      </section>

      <Cta />
      <PageEffects />
    </>
  );
}
