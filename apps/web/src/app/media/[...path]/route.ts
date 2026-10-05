import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Photos live in a Docker volume (MEDIA_DIR), not in the image or the repo.
// Names never change once written, so browsers and Cloudflare cache them for a year.

const ROOT = path.resolve(process.env.MEDIA_DIR ?? '.media');
const TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export async function GET(_req: Request, ctx: RouteContext<'/media/[...path]'>) {
  const parts = (await ctx.params).path;
  const file = path.resolve(ROOT, ...parts);
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type || !file.startsWith(ROOT + path.sep)) return new Response('Not found', { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(body.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
