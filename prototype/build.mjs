// Builds the VYONA prototype.
//   - JS/CSS bundled + minified with esbuild (three, gsap, motion inlined)
//   - fonts inlined as base64 woff2
//   - photos resized to WebP + tiny blur placeholders
//
// Two outputs, same source:
//   default  → .dist/vyona-prototype.html   one file, photos inlined as base64.
//              Works offline, travels over WhatsApp. ~4 MB.
//   --web    → .dist/web/{index.html,assets/*.webp}   photos as separate files
//              the browser lazy-loads. For the server: the document is ~900 KB
//              so the page paints before the photos arrive.
//
// Usage: node build.mjs [--web] [--watch] [--serve]

import { build } from 'esbuild';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const IMAGES = resolve(ROOT, '../images');
const CACHE = join(ROOT, '.cache');
const OUT_DIR = resolve(ROOT, '../.dist');

const args = new Set(process.argv.slice(2));
const WEB = args.has('--web');
const WEB_DIR = join(OUT_DIR, 'web');
const ASSETS = join(WEB_DIR, 'assets');
const OUT = WEB ? join(WEB_DIR, 'index.html') : join(OUT_DIR, 'vyona-prototype.html');
let assetBytes = 0; // total size of the web build's photo files
const MAX_EDGE = 1200;
const QUALITY = 60;

async function processImage(key, file) {
  const input = join(IMAGES, file);
  if (!existsSync(input)) throw new Error(`Missing photo for "${key}": ${file}`);
  const { mtimeMs } = await stat(input);
  const cacheFile = join(CACHE, `${key}-${Math.round(mtimeMs)}-${MAX_EDGE}-${QUALITY}.json`);
  if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));

  const img = sharp(input).rotate();
  const full = await img
    .clone()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer({ resolveWithObject: true });
  const lqip = await img.clone().resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();

  const entry = {
    src: `data:image/webp;base64,${full.data.toString('base64')}`,
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
    w: full.info.width,
    h: full.info.height,
  };
  await writeFile(cacheFile, JSON.stringify(entry));
  return entry;
}

async function buildImages() {
  const map = JSON.parse(await readFile(join(SRC, 'data/photos.json'), 'utf8'));
  delete map._note;
  await mkdir(CACHE, { recursive: true });
  const entries = await Promise.all(
    Object.entries(map).map(async ([key, file]) => [key, await processImage(key, file)])
  );
  if (!WEB) return Object.fromEntries(entries);

  // Web build: the full photo becomes a file the browser fetches lazily. The 24px
  // placeholder stays inline (~1 KB each) so blur-up still works on first paint.
  await mkdir(ASSETS, { recursive: true });
  const web = await Promise.all(
    entries.map(async ([key, e]) => {
      const bytes = Buffer.from(e.src.slice(e.src.indexOf(',') + 1), 'base64');
      await writeFile(join(ASSETS, `${key}.webp`), bytes);
      return [key, { ...e, src: `assets/${key}.webp`, bytes: bytes.length }];
    })
  );
  assetBytes = web.reduce((n, [, e]) => n + e.bytes, 0);
  return Object.fromEntries(web.map(([k, { bytes, ...e }]) => [k, e]));
}

async function bundle(entry, extra = {}) {
  const result = await build({
    entryPoints: [join(SRC, entry)],
    bundle: true,
    minify: true,
    write: false,
    target: ['es2020', 'safari15'],
    legalComments: 'none',
    loader: { '.woff2': 'dataurl', '.glsl': 'text', '.svg': 'text' },
    logLevel: 'warning',
    ...extra,
  });
  return result.outputFiles[0].text;
}

async function run() {
  const t0 = Date.now();
  const [html, css, js, images] = await Promise.all([
    readFile(join(SRC, 'index.html'), 'utf8'),
    bundle('styles/main.css'),
    bundle('js/main.js', { format: 'iife' }),
    buildImages(),
  ]);

  // Escape "</" so embedded code can never close its <script> early.
  const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1');
  const out = html
    .replace('<!-- @styles -->', () => `<style>${css}</style>`)
    .replace('<!-- @images -->', () => `<script type="application/json" id="vy-images">${safe(JSON.stringify(images))}</script>`)
    .replace('<!-- @script -->', () => `<script>${safe(js)}</script>`);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, out);
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  const doc = mb(Buffer.byteLength(out));
  const n = Object.keys(images).length;
  console.log(
    WEB
      ? `✓ ${OUT} — ${doc} MB document + ${mb(assetBytes)} MB in ${n} photo files, ${Date.now() - t0} ms`
      : `✓ ${OUT} — ${doc} MB, ${n} photos, ${Date.now() - t0} ms`
  );
}

async function safeRun() {
  try {
    await run();
  } catch (err) {
    console.error('✗ build failed:', err.message);
    if (!args.has('--watch')) process.exit(1);
  }
}

await safeRun();

if (args.has('--watch')) {
  let timer;
  watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(safeRun, 150);
  });
  console.log('… watching src/ for changes');
}

if (args.has('--serve')) {
  const port = Number(process.env.PORT || 5173);
  createServer(async (req, res) => {
    // In web mode the page also asks for assets/*.webp; everything else is the document.
    const path = (req.url || '/').split('?')[0];
    const asset = WEB && /^\/assets\/[\w.-]+\.webp$/.test(path);
    try {
      res.writeHead(200, {
        'content-type': asset ? 'image/webp' : 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(await readFile(asset ? join(WEB_DIR, path.slice(1)) : OUT));
    } catch {
      res.writeHead(asset ? 404 : 503).end(asset ? 'Not found' : 'Build not ready yet');
    }
  }).listen(port, '0.0.0.0', () => console.log(`→ preview on http://localhost:${port}`));
}
