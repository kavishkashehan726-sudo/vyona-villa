// The one recipe for every photo the site serves, from the prototype build
// (prototype/build.mjs): at most 1200px on the long side, WebP quality 60, and
// a 24px blurred WebP placeholder for blur-up. Used by media:import and by
// uploads in the admin.

import sharp from 'sharp';

export type ConvertedPhoto = { webp: Buffer; width: number; height: number; lqip: string };

export async function convertPhoto(input: string | Buffer): Promise<ConvertedPhoto> {
  const base = sharp(input, { limitInputPixels: 80_000_000 }).rotate();
  const { data, info } = await base
    .clone()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 60, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  const lqip = await base.clone().resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();
  return { webp: data, width: info.width, height: info.height, lqip: `data:image/webp;base64,${lqip.toString('base64')}` };
}
