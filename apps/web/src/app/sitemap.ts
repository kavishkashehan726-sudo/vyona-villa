import type { MetadataRoute } from 'next';
import { PILLARS, SHOW_DRAFT_PAGES } from '@/lib/content';
import { GALLERY } from '@/lib/gallery';
import { getPhotos } from '@/lib/media';
import { getRooms, SITE_URL } from '@/lib/site';

// Read per request, so rooms the owner adds or hides in the admin show up at once.
export const dynamic = 'force-dynamic';

// Every public page search engines should find, with its photos (Google Images reads them).
// Checkout pages stay out: robots.txt disallows them and they say nothing on their own.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [rooms, photos] = await Promise.all([getRooms(), getPhotos()]);
  const img = (keys: string[]) =>
    keys.map((k) => photos[k]?.src).filter((src): src is string => !!src).map((src) => `${SITE_URL}${src}`);
  const page = (path: string, priority: number, keys: string[] = []): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: 'weekly',
    priority,
    images: img(keys),
  });

  return [
    page('/', 1, ['hero-pool-cottage', 'hero-house', 'hero-pool-aerial', 'hero-night']),
    page('/stay', 0.9, ['studio-garden', ...rooms.map((r) => r.photos[0] ?? '')]),
    ...rooms.map((r) => page(`/stay/${r.slug}`, 0.8, r.photos)),
    page('/gallery', 0.7, GALLERY.map(([k]) => k)),
    page('/explore', 0.6, ['house-aerial', ...PILLARS.map((p) => p.photo)]),
    page('/contact', 0.6, ['hero-house']),
    ...(SHOW_DRAFT_PAGES ? [page('/about', 0.5), ...PILLARS.map((p) => page(`/explore/${p.slug}`, 0.5, [p.photo]))] : []),
  ];
}
