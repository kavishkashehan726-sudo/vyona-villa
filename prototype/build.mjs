// Builds the VYONA prototype into ONE self-contained HTML file.
//   - JS/CSS bundled + minified with esbuild (three, gsap, motion inlined)
//   - fonts inlined as base64 woff2
//   - photos resized to WebP + tiny blur placeholders, embedded as a JSON map
// Usage: node build.mjs [--watch] [--serve]

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
const OUT = join(OUT_DIR, 'vyona-prototype.html');

const args = new Set(process.argv.slice(2));
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
  return Object.fromEntries(entries);
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

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, out);
  const mb = (Buffer.byteLength(out) / 1024 / 1024).toFixed(2);
  console.log(`✓ ${OUT} — ${mb} MB, ${Object.keys(images).length} photos, ${Date.now() - t0} ms`);
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
  createServer(async (_req, res) => {
    try {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(await readFile(OUT));
    } catch {
      res.writeHead(503).end('Build not ready yet');
    }
  }).listen(port, '0.0.0.0', () => console.log(`→ preview on http://localhost:${port}`));
}
