// Page metadata in one shape: title, description, canonical URL, and the Open Graph and
// Twitter cards with a photo, so a link shared on WhatsApp, Facebook or X shows the villa.
// Next replaces `openGraph` as a whole when a page sets it, so every page goes through here.
// Server only: photos come from the database.

import type { Metadata } from 'next';
import { getPhotos } from './media';

export const SITE_NAME = 'VYONA Weligama';
export const HOME_TITLE = 'VYONA Weligama · Seven rooms on the South Coast';
export const HOME_DESCRIPTION =
  'A seven-room boutique villa among the palms, just beyond the bustle of Weligama, Sri Lanka. Pool, gardens and breakfast made here.';

/** The photo shared links show when a page has none of its own. */
const DEFAULT_PHOTO = 'hero-pool-cottage';

export async function pageMeta({
  title,
  description,
  path,
  photo = DEFAULT_PHOTO,
}: {
  /** Without the " · VYONA Weligama" the layout's template adds; null for the home page. */
  title: string | null;
  description: string;
  path: string;
  photo?: string;
}): Promise<Metadata> {
  const photos = await getPhotos();
  const p = photos[photo] ?? photos[DEFAULT_PHOTO];
  const images = p ? [{ url: p.src, width: p.w, height: p.h, alt: p.alt }] : undefined;
  const full = title ? `${title} · ${SITE_NAME}` : HOME_TITLE;
  return {
    ...(title && { title }),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_GB',
      url: path,
      title: full,
      description,
      images,
    },
    twitter: { card: 'summary_large_image', title: full, description, images },
  };
}
