// Converts the client photos in images/ into the WebP files the site serves
// (recipe in photo.ts), with the placeholder stored on the Media row.
//
// Idempotent: a photo whose row and file both exist is skipped, so this runs on
// every container start. That includes photos the owner replaced in the admin,
// whose rows point at a new file. Without images/ (CI, a fresh clone) it does nothing.

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './index';
import { PHOTOS } from './media-data';
import { convertPhoto } from './photo';

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
  const existing = new Map((await prisma.media.findMany({ select: { key: true, path: true } })).map((m) => [m.key, m.path]));

  let made = 0;
  let missing = 0;
  for (const [key, { file, alt }] of Object.entries(PHOTOS)) {
    const input = path.join(source, file);
    const rel = `photos/${key}.webp`;
    const output = path.join(target, rel);
    const current = existing.get(key);
    if (!force && current && existsSync(path.join(target, current))) continue;
    if (!existsSync(input)) {
      missing += 1;
      console.warn(`media: ${file} not found for ${key}`);
      continue;
    }

    await mkdir(path.dirname(output), { recursive: true });
    const photo = await convertPhoto(input);
    await writeFile(output, photo.webp);

    const data = { path: rel, alt, width: photo.width, height: photo.height, lqip: photo.lqip };
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
