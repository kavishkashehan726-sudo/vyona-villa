// The villa's contact details as the website shows them, edited in the admin's
// settings. One Setting row ('contact'); a missing row or field falls back to
// the defaults, so the contact section never renders empty.

import { prisma } from '@vyona/db';

export const SOCIALS = ['instagram', 'facebook', 'tiktok', 'youtube', 'tripadvisor'] as const;
export type Social = (typeof SOCIALS)[number];

export const SOCIAL_LABELS: Record<Social, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  tripadvisor: 'Tripadvisor',
};

export type ContactDetails = {
  address: string;
  phone: string;
  /** WhatsApp number in international form, digits only (94771234567). Empty hides the button. */
  whatsapp: string;
  email: string;
  /** What the map searches for: an address, a place name or "lat, lng". */
  mapQuery: string;
  /** Profile URLs; an empty one is not shown. */
  social: Record<Social, string>;
};

export const DEFAULT_CONTACT: ContactDetails = {
  address: '203/1 Punchideniya, Weligama, Sri Lanka',
  phone: '+94 77 000 0000',
  whatsapp: '94770000000',
  email: 'stay@vyona.lk',
  mapQuery: 'Punchideniya, Weligama, Sri Lanka',
  social: { instagram: '', facebook: '', tiktok: '', youtube: '', tripadvisor: '' },
};

export const CONTACT_KEY = 'contact';

/** The stored details, and whether the owner has saved them yet (until then they are placeholders). */
export async function loadContact(db: Pick<typeof prisma, 'setting'> = prisma): Promise<ContactDetails & { saved: boolean }> {
  const row = await db.setting.findUnique({ where: { key: CONTACT_KEY } });
  const stored = (row?.value ?? {}) as Partial<ContactDetails>;
  return {
    ...DEFAULT_CONTACT,
    ...stored,
    social: { ...DEFAULT_CONTACT.social, ...stored.social },
    saved: !!row,
  };
}

/** "5.9749, 80.429" → coordinates; anything else is a place to search for. */
export function mapCoords(q: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(q);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const whatsappHref = (digits: string) => `https://wa.me/${digits}`;
