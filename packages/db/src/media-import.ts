// Converts the client photos in images/ into the WebP files the site serves,
// with the same recipe as the prototype build (prototype/build.mjs): at most
// 1200px, quality 60, plus a 24px blurred placeholder stored on the Media row.
//
// Idempotent: a photo whose WebP and row both exist is skipped, so this runs on
// every container start. Without images/ (CI, a fresh clone) it does nothing.

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from './index';
import { PHOTOS } from './media-data';

const root = path.resolve(import.meta.dirname, '../../..');
const source = process.env.IMAGES_DIR ?? path.join(root, 'images');
const target = process.env.MEDIA_DIR ?? path.join(root, '.media');
const force = process.argv.includes('--force');

async function main() {
  if (!existsSync(source)) {
    console.log(`media: no ${source}, skipped`);
    return;
  }
  await mkdir(target, { recursive: true });
  const existing = new Set((await prisma.media.findMany({ select: { key: true } })).map((m) => m.key));

  let made = 0;
  let missing = 0;
  for (const [key, { file, alt }] of Object.entries(PHOTOS)) {
    const input = path.join(source, file);
    const rel = `photos/${key}.webp`;
    const output = path.join(target, rel);
    if (!force && existing.has(key) && existsSync(output)) continue;
    if (!existsSync(input)) {
      missing += 1;
      console.warn(`media: ${file} not found for ${key}`);
      continue;
    }

    await mkdir(path.dirname(output), { recursive: true });
    const base = sharp(input).rotate();
    const info = await base
      .clone()
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60, effort: 5 })
      .toFile(output);
    const lqip = await base.clone().resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();

    const data = {
      path: rel,
      alt,
      width: info.width,
      height: info.height,
      lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
    };
    await prisma.media.upsert({ where: { key }, create: { key, ...data }, update: data });
    made += 1;
  }
  console.log(`✓ media: ${made} converted, ${Object.keys(PHOTOS).length - made - missing} up to date`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
