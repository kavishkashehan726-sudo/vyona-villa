import { cache } from 'react';
import { prisma } from '@vyona/db';
import { loadContact, loadSettings, mapCoords, type ContactDetails } from '@vyona/core';
import type { RoomData } from './rooms';

export { lowestRate, roomSpecs, roomTitle, type RoomData } from './rooms';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Search engines may index the site: SITE_INDEXABLE=1, set once the client confirms real prices. */
export const indexable = () => process.env.SITE_INDEXABLE === '1';


export const getRooms = cache(
  async (): Promise<RoomData[]> =>
    prisma.room.findMany({
      where: { active: true },
      orderBy: { number: 'asc' },
      select: {
        slug: true,
        number: true,
        name: true,
        element: true,
        icon: true,
        keywords: true,
        category: true,
        sizeSqm: true,
        maxGuests: true,
        features: true,
        baseRate: true,
        photos: true,
      },
    }),
);

export const getSettings = cache(() => loadSettings());

/** Address, phone, email, map and social links, as the owner set them in the admin. */
export const getContact = cache(() => loadContact());

/** Inlines JSON in a <script> without letting "</script>" in the data close it. */
export const jsonScript = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export function lodgingJsonLd(
  rooms: RoomData[],
  settings: { checkInTime: string; checkOutTime: string },
  contact: ContactDetails,
) {
  const geo = mapCoords(contact.mapQuery);
  const sameAs = Object.values(contact.social).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${SITE_URL}/#villa`,
    name: 'VYONA Weligama',
    url: SITE_URL,
    description: 'A seven-room boutique villa with a pool and tropical gardens, one kilometre from Weligama Beach.',
    slogan: 'Your home on the South Coast. Naturally.',
    numberOfRooms: rooms.length,
    priceRange: '$$',
    telephone: contact.phone,
    email: contact.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: contact.address,
      addressLocality: 'Weligama',
      addressRegion: 'Southern Province',
      addressCountry: 'LK',
    },
    ...(geo && { geo: { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng } }),
    ...(sameAs.length > 0 && { sameAs }),
    amenityFeature: ['Outdoor swimming pool', 'Breakfast', 'Free Wi-Fi', 'Air conditioning'].map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
    checkinTime: settings.checkInTime,
    checkoutTime: settings.checkOutTime,
  };
}
