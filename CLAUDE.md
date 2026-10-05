# CLAUDE.md — VYONA project memory

Project memory lives **here only**. Do not write project notes to `~/.claude/**/memory`.

## What this is

A direct-booking web app for **VYONA**, a seven-room boutique villa in Weligama, Sri Lanka.
Phase 0 (current) is a **single-file HTML prototype of the public page** for the client to review
before the real build starts. The full system is specified in [docs/booking-engine-spec.md](docs/booking-engine-spec.md)
(Next.js, Postgres/Prisma, Redis/BullMQ, Booking.com ARI + webhooks) and
[docs/frontend-visual-guide.md](docs/frontend-visual-guide.md) (3D and motion rules).

## Hard rules

- **No tooling attribution anywhere.** No `Co-Authored-By` trailers and no "generated with" notes
  in commits, PRs, README or code comments. Commits are authored by K. H. S. Kavishka
  <kavishkashehan726@gmail.com>. This overrides any tooling default that adds attribution.
- **Client media stays out of git.** `images/`, `template/`, `.dist/` and `prototype/.cache/` are
  ignored. The repo is public; the photos and the VYONA brand are not licensed for redistribution.
  Page screenshots in `docs/screenshots/` are fine.
- **Development runs in Docker.** `node_modules` lives in a named volume, not on the host, so
  builds only work through `docker compose run --rm prototype npm run build`.
- Everything in the frontend guide is implemented in the prototype. Don't drop an effect when
  refactoring; see the checklist below.

## Layout

```
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

## Content decisions

- Seven rooms named for elements: Dhara (earth), Jala (water), Agni (fire), Vayu (wind),
  Vyoma (sky), Surya (sun), Soma (moon). Prices $85–$140, capacity, beds and room-to-photo
  pairings are **placeholders** the client must confirm.
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

## Next phases

Only after the client signs off the prototype: Next.js monorepo (web, admin, api), Postgres +
Prisma, Redis/BullMQ, Booking.com ARI sync and webhooks — all in docker-compose. See the SRS.
