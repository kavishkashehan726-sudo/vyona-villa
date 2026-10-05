import { cache } from 'react';
import { prisma } from '@vyona/db';
import { loadSettings } from '@vyona/core';
import type { RoomData } from './rooms';

export { lowestRate, roomSpecs, roomTitle, type RoomData } from './rooms';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

// PLACEHOLDERS until the client sends the real details (see CLAUDE.md).
export const CONTACT = {
  street: 'Placeholder Road',
  town: 'Weligama 81700',
  country: 'Sri Lanka',
  phone: '+94 77 000 0000',
  phoneHref: 'tel:+94770000000',
  email: 'stay@vyona.lk',
  instagram: '@vyona.weligama',
  instagramHref: '#',
  whatsapp: 'https://wa.me/94770000000',
  geo: { lat: 5.9749, lng: 80.429 },
};

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

/** Inlines JSON in a <script> without letting "</script>" in the data close it. */
export const jsonScript = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

export function lodgingJsonLd(rooms: RoomData[], settings: { checkInTime: string; checkOutTime: string }) {
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
    telephone: CONTACT.phone,
    email: CONTACT.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: CONTACT.street,
      addressLocality: 'Weligama',
      addressRegion: 'Southern Province',
      addressCountry: 'LK',
    },
    geo: { '@type': 'GeoCoordinates', latitude: CONTACT.geo.lat, longitude: CONTACT.geo.lng },
    amenityFeature: ['Outdoor swimming pool', 'Breakfast', 'Free Wi-Fi', 'Air conditioning'].map((name) => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
    checkinTime: settings.checkInTime,
    checkoutTime: settings.checkOutTime,
  };
}
