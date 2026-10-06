import type { MetadataRoute } from 'next';
import { indexable, SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Closed to crawlers until SITE_INDEXABLE=1; after that, everything but checkout and the API.
export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/', disallow: ['/book/', '/api/'] }, host: SITE_URL };
}
