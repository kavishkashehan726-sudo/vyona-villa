import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon, type IconName } from '@vyona/ui';
import { JsonLd } from '@/components/JsonLd';
import { PageEffects } from '@/components/PageEffects';
import { Photo } from '@/components/Photo';
import { Price } from '@/components/Price';
import { Booking } from '@/components/sections/Booking';
import { Cta } from '@/components/sections/Cta';
import { RoomCards } from '@/components/sections/Rooms';
import { getRooms, roomSpecs, roomTitle, SITE_URL } from '@/lib/site';

async function findRoom(slug: string) {
  const rooms = await getRooms();
  return { rooms, room: rooms.find((r) => r.slug === slug) };
}

export async function generateMetadata({ params }: PageProps<'/stay/[slug]'>): Promise<Metadata> {
  const { room } = await findRoom((await params).slug);
  if (!room) return {};
  return {
    title: `${room.name}, the ${room.element} room`,
    description: `${room.category}, ${room.sizeSqm} m², for up to ${room.maxGuests} guests. ${room.features.join(', ')}.`,
    alternates: { canonical: `/stay/${room.slug}` },
  };
}

export default async function RoomPage({ params }: PageProps<'/stay/[slug]'>) {
  const { rooms, room } = await findRoom((await params).slug);
  if (!room) notFound();
  const others = rooms.filter((r) => r.slug !== room.slug);

  return (
    <>
      <div className="page-top" />
      <article className="room-page" aria-labelledby="room-title">
        <div className="room-page__photos">
          {room.photos.slice(0, 3).map((k, i) => (
            <figure className="unveil ripple-host" key={k}>
              <Photo k={k} className="ripple" alt={i === 0 ? `${room.name}, the ${room.element} room` : undefined} />
            </figure>
          ))}
        </div>
        <div className="room-page__body reveal">
          <p className="eyebrow">
            <Link href="/stay">Stay</Link> · The {room.element} room
          </p>
          <Icon name={room.icon as IconName} className="stay-room__icon" />
          <h1 className="stay-room__name" id="room-title">
            {roomTitle(room)}
          </h1>
          {room.keywords.length > 0 && <p className="stay-room__keywords">{room.keywords.join(' · ')}</p>}
          <p className="stay-room__specs">{roomSpecs(room)}</p>
          <ul className="stay-room__features">
            {room.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="stay-room__price">
            <small>From</small>
            <Price cents={room.baseRate} /> <small>/ night</small>
          </p>
          <div className="stay-room__actions">
            <Link
              className="btn btn--olive btn--sm magnetic"
              href={`/book?room=${room.slug}`}
              data-open-booking
              data-room={room.slug}
              data-cursor="Book"
            >
              Check dates
            </Link>
            <Link className="link-caps" href="/stay">
              All rooms <Icon name="arrow" className="i" />
            </Link>
          </div>
          {room.keywords.length === 0 && <p className="proto-note">Keywords for {room.name} to come from the client.</p>}
        </div>
      </article>

      <Booking room={room.slug} title={`Dates for ${room.name}.`} />

      <section className="room-others rooms" aria-labelledby="others-title">
        <div className="section-head reveal">
          <h2 className="h2" id="others-title">
            The other rooms
          </h2>
        </div>
        <RoomCards rooms={others} />
      </section>

      <Cta />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'HotelRoom',
          name: `${room.name}, the ${room.element} room`,
          url: `${SITE_URL}/stay/${room.slug}`,
          floorSize: { '@type': 'QuantitativeValue', value: room.sizeSqm, unitCode: 'MTK' },
          occupancy: { '@type': 'QuantitativeValue', maxValue: room.maxGuests },
          bed: { '@type': 'BedDetails', typeOfBed: 'King', numberOfBeds: 1 },
          amenityFeature: room.features.map((f) => ({ '@type': 'LocationFeatureSpecification', name: f, value: true })),
          containedInPlace: { '@type': 'LodgingBusiness', name: 'VYONA Weligama', url: SITE_URL },
        }}
      />
      <PageEffects />
    </>
  );
}
