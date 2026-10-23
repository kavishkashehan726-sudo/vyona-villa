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
  /** The villa's Google Maps link as the owner pasted it (a share link); the address opens it. */
  mapLink: string;
  /** The map's embed URL, worked out from the link when it was saved; empty uses `mapQuery`. */
  mapEmbed: string;
  /** Profile URLs; an empty one is not shown. */
  social: Record<Social, string>;
};

export const DEFAULT_CONTACT: ContactDetails = {
  address: '203/1 Punchideniya, Weligama, Sri Lanka',
  phone: '+94 77 000 0000',
  whatsapp: '94770000000',
  email: 'stay@vyona.lk',
  mapQuery: 'Punchideniya, Weligama, Sri Lanka',
  mapLink: '',
  mapEmbed: '',
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

const EMBED = 'https://www.google.com/maps/embed?';
const searchEmbed = (q: string) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;

/** The iframe URL of the contact map: the owner's Google Maps link when it gave a place, else the map location. */
export function mapEmbedSrc(c: Pick<ContactDetails, 'mapQuery' | 'mapEmbed'>): string {
  return isEmbed(c.mapEmbed) ? c.mapEmbed : searchEmbed(c.mapQuery || DEFAULT_CONTACT.mapQuery);
}

/** Where "open in Google Maps" goes: the owner's link, or a search for the map location. */
export function mapsHref(c: Pick<ContactDetails, 'mapQuery' | 'mapLink'>): string {
  return c.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.mapQuery)}`;
}

const isEmbed = (src: string) => src.startsWith(EMBED) || /^https:\/\/www\.google\.com\/maps\?(.+&)?output=embed(&|$)/.test(src);

const GOOGLE_HOST = /^((www|maps)\.)?google\.[a-z.]{2,6}$/;
const SHORT_HOST = /^(maps\.app\.goo\.gl|goo\.gl)$/;

export type MapLink =
  /** An embed URL (or the src of the embed code): the map shows it as is; there is nothing to open. */
  | { kind: 'embed'; embed: string }
  /** A short share link (maps.app.goo.gl): it says where it points only once followed. */
  | { kind: 'short'; link: string }
  /** A full Google Maps URL; `embed` is empty when it carries no place. */
  | { kind: 'place'; link: string; embed: string };

/**
 * Reads what the owner pasted from Google Maps: a share link ("Share → Copy link"), the address bar's
 * URL, or the embed code ("Share → Embed a map") or its src. Null when it isn't a Google Maps link.
 */
export function parseMapLink(input: string): MapLink | null {
  let raw = input.trim();
  const iframe = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(raw);
  if (iframe) raw = iframe[1]!.replace(/&amp;/g, '&');
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  url.protocol = 'https:';
  const host = url.hostname.toLowerCase();
  if (SHORT_HOST.test(host)) {
    return host === 'goo.gl' && !url.pathname.startsWith('/maps') ? null : { kind: 'short', link: url.href };
  }
  if (!GOOGLE_HOST.test(host) || !(url.pathname.startsWith('/maps') || host.startsWith('maps.'))) return null;
  if (url.pathname.startsWith('/maps/embed')) {
    const embed = `${EMBED}${url.search.slice(1)}`;
    return url.search.length > 1 ? { kind: 'embed', embed } : null;
  }
  const where = mapPlace(url.href);
  return { kind: 'place', link: url.href, embed: where ? searchEmbed(where) : '' };
}

/** The place a full Google Maps URL points at: the pin's coordinates, else its search, else the view's centre. */
export function mapPlace(href: string): string | null {
  const url = new URL(href);
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(href);
  if (pin) return `${pin[1]}, ${pin[2]}`;
  const q = url.searchParams.get('q') ?? url.searchParams.get('query') ?? url.searchParams.get('destination');
  if (q?.trim()) return q.trim();
  const named = /\/maps\/(?:place|search)\/([^/@]+)/.exec(url.pathname);
  if (named) return decodeURIComponent(named[1]!.replace(/\+/g, ' ')).trim() || null;
  const centre = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(href);
  return centre ? `${centre[1]}, ${centre[2]}` : null;
}

/**
 * Follows a short share link (maps.app.goo.gl) to the full Google Maps URL it redirects to, so the
 * map can show its place. Null when Google can't be reached or answers with anything else.
 */
export async function followMapLink(link: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  let href = link;
  for (let hop = 0; hop < 5; hop++) {
    let res: Response;
    try {
      res = await fetcher(href, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    } catch {
      return null;
    }
    const next = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !next) return null;
    href = new URL(next, href).href;
    // Outside some countries Google asks about cookies first; the map's URL rides along in `continue`.
    const consent = new URL(href);
    if (consent.hostname.startsWith('consent.')) href = consent.searchParams.get('continue') ?? href;
    const parsed = parseMapLink(href);
    if (parsed?.kind === 'place') return parsed.link;
    if (parsed?.kind !== 'short') return null;
  }
  return null;
}

export const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
export const whatsappHref = (digits: string) => `https://wa.me/${digits}`;
/** Opens the visitor's mail app with a new message to the villa, the subject filled in. */
export const mailHref = (email: string, subject = 'Enquiry about VYONA') =>
  `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}`;
