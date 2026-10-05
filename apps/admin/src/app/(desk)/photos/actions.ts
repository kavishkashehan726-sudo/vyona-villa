'use server';

import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { prisma } from '@vyona/db';
import { PHOTOS } from '@vyona/db/media-data';
import { convertPhoto } from '@vyona/db/photo';
import { attempt, fail, ok, text, type Result } from '@/lib/actions';
import { requireAdmin } from '@/lib/session';

const MEDIA_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_DIR ?? '.media');
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ROOM_PHOTOS = 12;

function done(message: string) {
  revalidatePath('/', 'layout');
  return ok(message);
}

/** "IMG_2041 copy.JPG" → "img-2041-copy". */
const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

/** Converts an uploaded file and writes it under a name of its own, so caches never serve the old photo. */
async function store(file: File, key: string) {
  if (/hei[cf]$/i.test(file.name) || /hei[cf]/i.test(file.type)) {
    throw new UploadError('iPhone HEIC photos can’t be read here. Export it as JPEG (Share → Save as JPEG, or AirDrop to a Mac) and upload that.');
  }
  if (file.size > MAX_BYTES) throw new UploadError('That photo is over 15 MB. Send a smaller copy (WhatsApp’s is fine).');
  let photo;
  try {
    photo = await convertPhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    throw new UploadError('That file isn’t a photo this can read. Use a JPEG, PNG or WebP.');
  }
  const hash = createHash('sha256').update(photo.webp).digest('hex').slice(0, 8);
  const rel = `photos/${key}-${hash}.webp`;
  await mkdir(path.join(MEDIA_DIR, 'photos'), { recursive: true });
  await writeFile(path.join(MEDIA_DIR, rel), photo.webp);
  return { path: rel, width: photo.width, height: photo.height, lqip: photo.lqip };
}

class UploadError extends Error {}

/** Removes a photo file, but only one inside MEDIA_DIR. */
async function remove(rel: string) {
  const file = path.resolve(MEDIA_DIR, rel);
  if (!file.startsWith(MEDIA_DIR + path.sep)) return;
  await unlink(file).catch(() => {});
}

function upload(fd: FormData) {
  const file = fd.get('file');
  return file instanceof File && file.size > 0 ? file : null;
}

export async function uploadPhoto(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const file = upload(fd);
    if (!file) return fail('Choose a photo to upload.');
    const alt = text(fd, 'alt', 200);
    if (!alt) return fail('Describe the photo in a few words. Screen readers and search engines read it.');

    const base = slug(text(fd, 'name', 60) || file.name) || 'photo';
    const taken = new Set((await prisma.media.findMany({ where: { key: { startsWith: base } }, select: { key: true } })).map((m) => m.key));
    let key = base;
    for (let i = 2; taken.has(key); i += 1) key = `${base}-${i}`;

    try {
      const stored = await store(file, key);
      await prisma.media.create({ data: { key, alt, ...stored } });
    } catch (err) {
      if (err instanceof UploadError) return fail(err.message);
      throw err;
    }
    const roomId = text(fd, 'roomId', 40);
    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId }, select: { photos: true, name: true } });
      if (room && room.photos.length < MAX_ROOM_PHOTOS) {
        await prisma.room.update({ where: { id: roomId }, data: { photos: [...room.photos, key] } });
        return done(`Uploaded, and added to ${room.name}.`);
      }
    }
    return done('Uploaded. Add it to a room above, or leave it in the library.');
  });
}

export async function replacePhoto(key: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const file = upload(fd);
    if (!file) return fail('Choose the new photo.');
    const current = await prisma.media.findUnique({ where: { key } });
    if (!current) return fail('That photo no longer exists.');
    try {
      const stored = await store(file, key);
      await prisma.media.update({ where: { key }, data: stored });
      if (stored.path !== current.path) await remove(current.path);
    } catch (err) {
      if (err instanceof UploadError) return fail(err.message);
      throw err;
    }
    return done('Replaced. The website shows the new photo now.');
  });
}

export async function saveAlt(key: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const alt = text(fd, 'alt', 200);
    if (!alt) return fail('Describe the photo in a few words.');
    await prisma.media.update({ where: { key }, data: { alt } });
    return done('Saved the description.');
  });
}

export async function deletePhoto(key: string, _prev: Result, _fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    if (key in PHOTOS) return fail('The website’s own pages use this photo. Replace it instead.');
    const users = await prisma.room.findMany({ where: { photos: { has: key } }, select: { name: true } });
    if (users.length) return fail(`Remove it from ${users.map((u) => u.name).join(', ')} first.`);
    const media = await prisma.media.delete({ where: { key } }).catch(() => null);
    if (media) await remove(media.path);
    return done('Deleted the photo.');
  });
}

function swap(list: string[], a: number, b: number) {
  const t = list[a]!;
  list[a] = list[b]!;
  list[b] = t;
}

/** Reorders, adds or removes one of a room's photos. The first is the cover. */
export async function editRoomPhotos(roomId: string, _prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const room = await prisma.room.findUnique({ where: { id: roomId }, select: { photos: true, name: true } });
    if (!room) return fail('That room no longer exists.');
    const [op, key = ''] = text(fd, 'op', 120).split(':');
    const photos = [...room.photos];
    const i = photos.indexOf(key);
    let message: string;

    if (op === 'add') {
      const add = text(fd, 'add', 80);
      if (!add) return fail('Choose a photo from the library.');
      if (photos.includes(add)) return fail(`${room.name} already has that photo.`);
      if (photos.length >= MAX_ROOM_PHOTOS) return fail(`A room can have up to ${MAX_ROOM_PHOTOS} photos.`);
      if (!(await prisma.media.findUnique({ where: { key: add }, select: { key: true } }))) return fail('That photo no longer exists.');
      photos.push(add);
      message = `Added to ${room.name}.`;
    } else if (i === -1) {
      return fail('That photo is no longer on this room. Reload the page.');
    } else if (op === 'left' && i > 0) {
      swap(photos, i, i - 1);
      message = i === 1 ? `That’s ${room.name}’s cover now.` : 'Moved.';
    } else if (op === 'right' && i < photos.length - 1) {
      swap(photos, i, i + 1);
      message = 'Moved.';
    } else if (op === 'cover' && i > 0) {
      photos.splice(i, 1);
      photos.unshift(key);
      message = `That’s ${room.name}’s cover now.`;
    } else if (op === 'remove') {
      if (photos.length === 1) return fail('A room needs at least one photo. Add another before removing this one.');
      photos.splice(i, 1);
      message = `Removed from ${room.name}. It’s still in the library.`;
    } else {
      return fail('Nothing to change.');
    }
    await prisma.room.update({ where: { id: roomId }, data: { photos } });
    return done(message);
  });
}
