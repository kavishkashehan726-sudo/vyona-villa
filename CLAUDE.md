# CLAUDE.md — VYONA project memory

Project memory lives **here only**. Do not write project notes to `~/.claude/**/memory`.

## What this is

A direct-booking web app for **VYONA**, a seven-room boutique villa in Weligama, Sri Lanka.
The full system is specified in [docs/booking-engine-spec.md](docs/booking-engine-spec.md)
(Next.js, Postgres/Prisma, Redis/BullMQ, Booking.com ARI + webhooks) and
[docs/frontend-visual-guide.md](docs/frontend-visual-guide.md) (3D and motion rules).

- **Phase 0 (done, client approved):** `prototype/`, a single-file HTML page, still live at the
  domain until the cut-over. It is frozen; it is the visual reference for the port, not edited.
- **Phase 1 (current):** the real system in a pnpm + Turborepo monorepo. Build order:
  1 scaffold ✓ · 2 core (pricing, hold transaction, tests) · 3 public site port · 4 booking +
  PayHere · 5 admin · 6 Beds24 · 7 production. Client feedback lives in `client updates/`
  (gitignored) and is summarised under *Content decisions*.

## Hard rules

- **No tooling attribution anywhere.** No `Co-Authored-By` trailers and no "generated with" notes
  in commits, PRs, README or code comments. Commits are authored by K. H. S. Kavishka
  <kavishkashehan726@gmail.com>. This overrides any tooling default that adds attribution.
- **Client media stays out of git.** `images/`, `template/`, `.dist/` and `prototype/.cache/` are
  ignored. The repo is public; the photos and the VYONA brand are not licensed for redistribution.
  Page screenshots in `docs/screenshots/` are fine.
- **Development runs in Docker.** Every `node_modules` and `.next` lives in a named volume, not on
  the host, so commands only work inside the containers (`docker compose run --rm sh …`).
- Everything in the frontend guide is implemented in the prototype. Don't drop an effect when
  refactoring; see the checklist below.

## Layout

```
apps/
  web/              Next 16 public site + public API as route handlers (:3000)
  admin/            Next 16 dashboard, admin.vyonaweligama.com (:3001)
  worker/           BullMQ worker: Beds24 sync, hold expiry, emails
packages/
  db/               Prisma 7 schema, migrations, idempotent seed (seed-data.ts = client brief)
  core/             pricing, availability, booking transaction, PayHere, Beds24, queue names
  ui/               tokens.css (Tailwind 4 @theme), icons.tsx, logo.tsx (swap point for the
                    official logo)
docker/             dev.Dockerfile
.github/workflows/  ci.yml: typecheck, test, build against postgres + redis services
brand/              vyona-logo.svg, vyona-mark.svg (redrawn from the template nav logo)
docs/               specs + screenshots for the README
scripts/            deploy.sh + deploy.env.example (deploy.env is gitignored)
images/             59 client photos (ignored)
template/           the design reference JPEG (ignored)
prototype/
  build.mjs         sharp → WebP + 24px LQIP, esbuild → one inlined HTML file
  src/index.html    full markup with data-* hooks
  src/styles/       main.css (tokens, sections, responsive), fonts.css (@fontsource, inlined)
  src/js/           main, capability, images, ui, rooms, gallery, booking, hero, motion,
                    magnetic, cursor, ripple, villa3d, store + water.vert/frag.glsl
  src/data/photos.json   key → filename in images/
.dist/              built prototype (ignored)
```

## Commands

Phase 1:

```bash
docker compose up                        # postgres, redis, mailpit + app (install, migrate, seed, turbo dev)
                                         # web :3000 · admin :3001 · mailpit :8025
docker compose run --rm sh pnpm typecheck   # also: test, build, db:migrate, db:studio
timeout 20 docker logs --tail 100 vyona_villa-app-1   # `docker compose logs` hangs here
```

Prototype (profile `prototype`):

```bash
docker compose run --rm prototype npm run build      # → .dist/vyona-prototype.html  (one file)
docker compose run --rm prototype npm run build:web  # → .dist/web/  (document + assets/)
docker compose up prototype                          # watch + serve on :5173
./scripts/deploy.sh --build                          # build:web + rsync to the VPS
```

**Two builds from one source.** `build` inlines every photo as base64: ~4 MB, fully offline, for
sending over WhatsApp. `build:web` writes the photos to `assets/*.webp` and leaves only the 24px
placeholders inline: a 0.93 MB document (356 KB compressed) the browser paints before the photos
arrive. `images.js` treats `p.src` as an opaque URL, so neither mode needs a JS change.

Neither build makes an external request except the Google Maps iframe, which loads lazily and only
when online.

## Deployment

Live at **https://vyonaweligama.com** — CloudPanel static site on the OVH Canada VPS (address in `scripts/deploy.env`),
behind Cloudflare. `scripts/deploy.sh` rsyncs `.dist/web/` to the site root; `scripts/deploy.env`
holds host, user and path and is **gitignored** because the repo is public.

- SSH as the site user `vyonaweligama` with `~/.ssh/vyona_deploy`. Never root: the key can only
  write into one htdocs folder.
- Cloudflare SSL mode is **Full**, and the SSL mode is per-zone, not per-account. Full (strict)
  is only safe once CloudPanel holds a real Let's Encrypt cert — with the self-signed default it
  returns error 526 to every visitor. Flexible is never right: CloudPanel's own HTTPS redirect
  turns it into a redirect loop.
- `www` 301s to the apex. Both records are proxied (orange cloud).
- The prototype is `noindex` in the markup and disallowed in `robots.txt` while prices are
  placeholders.

## Design tokens

Taken from `template/`:

| Token | Value |
|---|---|
| linen (page) | `#F1ECE3` |
| sand | `#E6DED1` |
| olive (CTA, quote panel) | `#4A4F3A` |
| olive-deep | `#3A3F2E` |
| ink (text) | `#2B2A26` |
| taupe (body copy) | `#6B6457` |
| bronze (icons, rules) | `#A88B5E` |

Type: **Cormorant Garamond** for display (hero is italic), **Jost** for uppercase letter-spaced
labels and UI. Motifs: thin rules, wide tracking, palm-shadow overlays, line icons for the seven
elements, pointed-oval seed logo.

## Phase 1 decisions

- Hosting: same VPS, Docker. Images are built in CI (GHCR), never on the VPS (RAM and disk are
  tight). CloudPanel reverse-proxies the apex → :3000 and the admin subdomain → :3001.
- The API lives in Next route handlers in `apps/web`, not a separate service (one fewer container).
- Payments: **PayHere** (sandbox until the merchant account exists).
- Booking.com: **through Beds24** API v2, behind an adapter that is mocked until the client has an
  account.
- Money in integer cents, USD. `RoomDay` holds one row per room per night, created on demand and
  locked with `SELECT … FOR UPDATE` for holds.
- Logo: the redrawn SVG in `packages/ui/src/logo.tsx` until the official file arrives.
- Client reference images are for layout only; use the real photos, with a slot for a beach shot.

## Content decisions

- Rooms, from the client's brief (`packages/db/src/seed-data.ts`): 1 Dhara (earth), 2 Jala
  (water), 3 Vayu (air), 4 Agni (fire), 5 Soma (moon), 6 Surya (sun), 7 Tara (star). **Vyoma is
  dropped.** Two 26 m² studios at $95 and five king rooms at $50–$75. Card titles read
  `[icon] 1 - DHARA`. Tara's keywords are missing, and Tara borrows Vyoma's photos for now.
- Hero: "Your home on the South Coast. *Naturally.*" ("Naturally." italic bronze), sub-heading
  "Seven rooms among the palms, just beyond the bustle of Weligama.", handwritten
  "Weligama / Sri Lanka" top right (Mrs Saint Delafield), button `BOOK YOUR STAY →`.
- Nav: STAY · EXPLORE · ABOUT | logo | GALLERY · CONTACT · Book your stay.
- Explore: VYONA / FOOD / BEYOND VYONA columns, Stay intro, "In every room" and "A room, and a
  little more": use the client's copy word for word (in `client updates/`). About has no copy yet.
- Prototype only: seven element rooms including Vyoma at placeholder prices $85–$140.
- Currency: USD by default, LKR toggle at a flat `LKR_PER_USD = 300` (placeholder rate).
- Booking is a mock: availability comes from a deterministic FNV hash of the date, so the calendar
  looks realistic and stays stable between reloads. Nightly rate +20% Dec–Mar, +12% Fri/Sat;
  10% service charge; 10% off at 7+ nights; 15-minute hold on the confirm step.
- Contact details, address and social handles are placeholders, marked on the page.

## Frontend guide checklist (all live in the prototype)

| Guide item | Where |
|---|---|
| 3D villa, orbit limits (polar π/4–π/2.1, distance 8–25, no pan) | `js/villa3d.js` |
| Raycast hover glow + "✨ Name · Tap to inspect" tag, click → camera fly + info card | `js/villa3d.js` |
| Custom GLSL water (waves, fresnel, caustics, sun glint, hover glow) | `js/water.*.glsl` |
| Cinematic hero (Ken Burns cross-fade, `<video>` slot kept for later) | `js/hero.js` |
| Deep parallax + scroll masking (scaleY unveils) | `js/motion.js`, `.unveil` in CSS |
| Liquid hover: one shared WebGL canvas moved over the hovered image | `js/ripple.js` |
| Magnetic buttons (pull /3, spring 150/15/0.1) + custom cursor | `js/magnetic.js`, `js/cursor.js` |
| Blur-up loading, fixed aspect boxes (low CLS) | `js/images.js`, `.blur-img` |
| Capability check → photo-slider fallback, no ripple/cursor | `js/capability.js` (`?lite=1` / `?full=1`) |
| Transform/opacity-only animation, reduced motion respected | throughout |
| SEO meta + JSON-LD `LodgingBusiness` | `index.html` |
| Draco pipeline for the real `.glb` | documented in README, not used yet |

## Gotchas

- **Turbo 2 runs tasks in strict env mode**: any variable not listed in `turbo.json` is stripped.
  Runtime secrets go in `globalPassThroughEnv`, or Prisma silently falls back to localhost and
  fails with `ECONNREFUSED`.
- `pnpm --filter x deploy` runs pnpm's built-in `deploy`, not the script. Use `run`.
- Prisma 7: the datasource URL lives in `prisma.config.ts`, the client is generated into
  `packages/db/src/generated` (gitignored), and it connects through `@prisma/adapter-pg`.
- BullMQ 6 needs a constructed ioredis client (`createRedis()` in core), not connection options.
- Next 16: `middleware` is now `proxy.ts`, and route params are async.

- `aspect-ratio` does nothing on an inline element — the room card image wrapper is a `<span>` and
  needs `display: block`.
- Images inside an aspect-ratio box need `width/height: 100%; object-fit: cover`, or the box grows
  to the photo's natural height.
- Day cells in the calendar carry `data-day` as **epoch day numbers**, not ISO dates.
- Hover styles must not override `.is-start` / `.is-end` in the calendar.
- The client's photos are WhatsApp-compressed to ~1200px; hero images can't go sharper until the
  originals arrive.
- Playwright MCP can only write inside the project, hence `.playwright-mcp/` (ignored).
- `scp` takes `-P` for the port, `ssh` takes `-p`. Sharing one options array between them makes
  scp read the port number as a filename.
- Base64 costs about a third on the wire even after gzip: the same page is 2.82 MB compressed
  when photos are inlined and 356 KB when they are files.
- Cloudflare does not cache HTML by default (`cf-cache-status: DYNAMIC`) but does cache `.webp`.
  That is most of why the split build helps — photos come from the Singapore edge, not Canada.

## Waiting on the client

Official logo, Tara's keywords, About copy and host photos, Explore subpage copy, real contact
details and address, high-res photos (beach, food, video), PayHere merchant account, Beds24
account, SMTP provider, tax and service-charge rules, check-in/out times, cancellation policy.
Placeholders are marked on the page; nothing blocks on these.
