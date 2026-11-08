// Converts the client photos in images/ into the WebP files the site serves
// (recipe in photo.ts), with the placeholder stored on the Media row.
//
// Idempotent, so it runs on every container start and deploy. Each file is named
// after its source (`photos/<key>.<hash>.webp`): /media/ is cached for a year,
// so a new source must get a new URL. A photo is converted again only when its
// source changed, never when the owner replaced it in the admin (those files are
// `photos/<key>-<hash>.webp`). Earlier files are left for pages still being served.
// Without images/ (CI, a fresh clone) it does nothing.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from './index';
import { PHOTOS } from './media-data';
import { convertPhoto } from './photo';
import { LEGACY_ROOM_PHOTOS, ROOMS } from './seed-data';

const root = path.resolve(import.meta.dirname, '../../..');
const source = process.env.IMAGES_DIR ?? path.join(root, 'images');
const target = process.env.MEDIA_DIR ?? path.join(root, '.media');
const force = process.argv.includes('--force');

/** Bump when convertPhoto's output changes, so every photo is made again. */
const RECIPE = '2';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A file this import wrote (old fixed name or hashed), as opposed to an admin replacement. */
const imported = (key: string, rel: string) =>
  rel === `photos/${key}.webp` || new RegExp(`^photos/${escape(key)}\\.[0-9a-f]{8}\\.webp$`).test(rel);

async function main() {
  if (!existsSync(source)) {
    console.log(`media: no ${source}, skipped`);
    return;
  }
  await mkdir(path.join(target, 'photos'), { recursive: true });
  const existing = new Map((await prisma.media.findMany({ select: { key: true, path: true } })).map((m) => [m.key, m.path]));

  let made = 0;
  let missing = 0;
  for (const [key, { file, alt, hero = false }] of Object.entries(PHOTOS)) {
    const input = path.join(source, file);
    const current = existing.get(key);
    const have = current !== undefined && existsSync(path.join(target, current));
    if (!force && have && !imported(key, current!)) continue;
    if (!existsSync(input)) {
      if (have) continue;
      missing += 1;
      console.warn(`media: ${file} not found for ${key}`);
      continue;
    }

    const hash = createHash('sha256')
      .update(await readFile(input))
      .update(`${RECIPE}:${hero}`)
      .digest('hex')
      .slice(0, 8);
    const rel = `photos/${key}.${hash}.webp`;
    if (!force && have && current === rel) continue;

    const photo = await convertPhoto(input, { hero });
    await writeFile(path.join(target, rel), photo.webp);
    const data = { path: rel, alt, width: photo.width, height: photo.height, lqip: photo.lqip };
    await prisma.media.upsert({ where: { key }, create: { key, ...data }, update: data });
    made += 1;
  }
  console.log(`✓ media: ${made} converted, ${Object.keys(PHOTOS).length - made - missing} up to date`);

  await upgradeRooms();
}

/**
 * Rooms still showing the photos the seed first gave them move to the current set,
 * once every one of those photos exists. A room whose photos the owner changed is left alone.
 */
async function upgradeRooms() {
  const keys = new Set((await prisma.media.findMany({ select: { key: true } })).map((m) => m.key));
  for (const { slug, photos } of ROOMS) {
    const legacy = LEGACY_ROOM_PHOTOS[slug];
    if (!legacy || !photos.every((k) => keys.has(k))) continue;
    const { count } = await prisma.room.updateMany({ where: { slug, photos: { equals: legacy } }, data: { photos } });
    if (count) console.log(`✓ media: ${slug} now shows ${photos.join(', ')}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
