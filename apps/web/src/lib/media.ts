import { cache } from 'react';
import { prisma } from '@vyona/db';

export type Photo = { src: string; lqip: string; w: number; h: number; alt: string };
export type PhotoMap = Record<string, Photo>;

/** Every photo by key, once per request. Files are served by app/media/[...path]. */
export const getPhotos = cache(async (): Promise<PhotoMap> => {
  const rows = await prisma.media.findMany();
  return Object.fromEntries(
    rows.map((m) => [m.key, { src: `/media/${m.path}`, lqip: m.lqip, w: m.width, h: m.height, alt: m.alt }]),
  );
});

/**
 * What the browser needs to load a photo it was not server-rendered with
 * (lightbox, 3D villa card, room dialog): no placeholders, so it stays small.
 */
export function clientPhotos(photos: PhotoMap) {
  return Object.fromEntries(Object.entries(photos).map(([k, p]) => [k, { src: p.src, w: p.w, h: p.h }]));
}
