# Development diary

A running handover log, so the work can continue on another machine or in another session.
Newest entry on top. Read [CLAUDE.md](CLAUDE.md) first for the rules and design tokens.

---

## 2026-10-05 — Phase 1 step 1: monorepo scaffold

The client approved the prototype and sent feedback (`client updates/feed_back_session_1/`,
gitignored). Development moves to the real stack; the prototype is frozen.

### Done

- pnpm + Turborepo monorepo: `apps/web`, `apps/admin` (Next 16.3, React 19.3, Tailwind 4.3),
  `apps/worker` (BullMQ 6), `packages/db` (Prisma 7.10), `packages/core`, `packages/ui`.
- Prisma schema and first migration: Room, RoomDay, RateRule, Reservation, Payment, SyncLog,
  Media, AdminUser, Setting. Money is integer cents.
- Idempotent seed with the client's room list (Vyoma dropped, Tara added), rate rules from the
  prototype (+20% Dec–Mar, +12% Fri/Sat) and the booking settings. It runs on every container start.
- `packages/ui`: design tokens as a Tailwind `@theme`, the prototype's line icons plus a star for
  Tara, and the logo behind one component.
- docker-compose: postgres 17, redis 7, mailpit, one `app` container running `turbo dev`
  (web :3000, admin :3001, worker), a `sh` tools service; the prototype moved behind a profile.
- CI (`.github/workflows/ci.yml`): typecheck, test, build against postgres and redis services.
- The origin IP was scrubbed from public files before the Phase 0 push.

### Problems hit

- Every Prisma query from Next and the worker failed with `ECONNREFUSED` while a direct `tsx`
  script worked. Turbo 2's strict env mode strips undeclared variables, so `DATABASE_URL` never
  reached the tasks. Fixed with `globalPassThroughEnv`.
- `pnpm --filter @vyona/db deploy` ran pnpm's own `deploy` command; scripts now use `run`.
- BullMQ 6 refused connection options without ioredis installed; core now exports `createRedis()`.

### Next

Step 2: port `nightly`/`quote` from `prototype/src/js/booking.js` into `packages/core` with rules
from the database, the hold transaction (`SELECT … FOR UPDATE` on RoomDay), unit tests and a
20-parallel-holds concurrency test.

---

## 2026-09-23 — Deployed to vyonaweligama.com

### Done

- Domain `vyonaweligama.com` (Namecheap, Cloudflare nameservers) pointed at the CloudPanel VPS,
  on OVH (address in `scripts/deploy.env`, not in the repo — it would bypass Cloudflare). Created as a **Static HTML Site**, site user `vyonaweligama`.
- Dedicated deploy key `~/.ssh/vyona_deploy`, authorised for the site user only — not root, so it
  can only write into one htdocs folder.
- `scripts/deploy.sh` rsyncs the build to the server and writes `robots.txt`. Server details live
  in `scripts/deploy.env`, gitignored.
- Added a **web build** (`npm run build:web`, `--web` in build.mjs): photos are written to
  `assets/*.webp` instead of being inlined as base64. Only the 24px placeholders stay in the
  document, so blur-up still works on first paint. `images.js` needed no change — it already
  treated `p.src` as an opaque URL.

### Why the web build was needed

The single file is right for WhatsApp and wrong for a server. Measured on the live site:

| | single file | web build |
|---|---|---|
| Document, compressed | 2.82 MB | **356 KB** |
| Photos | in the document | 2.5 MB, lazy, cached at the edge |
| Cloudflare cache | `DYNAMIC` (HTML is never cached) | `HIT` on the photos |
| Load on a slow link | 98 s | 2.7 s |

Cloudflare does not cache HTML by default but does cache `.webp`, so after the split the photos
serve from the Singapore edge instead of OVH Canada. Both builds ship from the same source; the
single file is still what goes over WhatsApp.

### Verified

- DNS clean on 1.1.1.1, 8.8.8.8 and 9.9.9.9; the old Namecheap parking A record is gone.
- Valid TLS chain through Cloudflare (`ssl_verify_result=0`). `www` 301s to the apex.
- Deployed document SHA-256 matches the local build; 49 asset files on the server.
- Playwright against the byte-identical build: no console errors, no broken images, photos load
  lazily on scroll (1 above the fold, 25 after scrolling, the rest only when a dialog opens),
  3D canvas renders, map loads.

### Gotchas hit

- Two A records on the apex (the new one and Namecheap's parking IP). Let's Encrypt round-robined
  onto the dead one and failed with "Timeout during connect (likely firewall problem)" — nothing
  to do with the firewall. Deleting the stale record fixed it.
- Cloudflare SSL mode is **per-zone**, not per-account, so changing it cannot affect other domains.
  Full is correct here; Full (strict) would return 526 against CloudPanel's self-signed default.
- `scp` takes `-P` for the port, `ssh` takes `-p`.

### Next

1. Send the link to the client, and the single file over WhatsApp as a backup.
2. Collect feedback on copy, room details, prices and photo choices.
3. Quality photos and the missing assets (beach photo, hero video, `.glb`) before Phase 1.
4. Phase 1 proper: Next.js monorepo, Postgres + Prisma, Redis/BullMQ, Booking.com ARI sync.

## 2026-09-22 — Phase 0: project setup + client prototype

### Done

- Moved the two spec documents into `docs/` (`booking-engine-spec.md`, `frontend-visual-guide.md`).
- Set up Docker dev (`docker-compose.yml`, service `prototype` on `node:22-alpine`, `node_modules`
  in a named volume) and the build script `prototype/build.mjs`:
  sharp resizes the client photos to 1200px WebP (q60) plus 24px blurred placeholders, esbuild
  bundles the JS/CSS, and everything (fonts as base64 woff2, three, gsap, motion) is inlined into
  one file at `.dist/vyona-prototype.html` (~4 MB, 49 photos, builds in well under a second warm).
- Redrew the nav logo from the template as `brand/vyona-logo.svg` and `brand/vyona-mark.svg`.
- Built the full public page: nav, Ken Burns hero, welcome + olive quote panel, seven element
  rooms with a detail dialog, interactive 3D villa, experiences, amenities strip, gallery with
  filters and lightbox, parallax statement, 3-step mock booking, location/contact, CTA band, footer.
- Every item in the frontend guide is implemented — see the checklist in CLAUDE.md.
- Verified in Playwright: no console errors; 3D hover tag, camera fly and info card work; the
  booking flow completes Dates → Details → Confirm → reference; USD/LKR toggle; room dialog and
  lightbox; widths 320 / 390 / 768 / 1080 / 1440 / 2560 with no horizontal scroll; `?lite=1` and
  reduced motion both fall back to the photo slider with ripple and cursor off; the file opens over
  `file://` with no external requests.

### Fixed during verification

- Hero title was too large; `--fs-hero` max is now 5.2rem.
- 320px overflowed: the calendar's seven 40px day cells forced a 332px column. Grid tracks are now
  `minmax(0, 1fr)` and cells shrink below 380px.
- The prototype notice covered the hero copy on phones; it is now a compact pill under the nav.
- Room dialog photos spilled over the text on mobile (images kept their natural height inside the
  grid).
- Room cards had uneven photo heights: the image wrapper is a `<span>`, so `aspect-ratio` never
  applied. It is `display: block` now, with the image set to cover.
- The calendar's hover colour overrode the selected check-in/check-out day.
- At 2560px the hero copy sat at the screen edge while the nav was centred in the 2200px column.
- `?lite=1` still enabled the custom cursor; low-power devices now get no cursor, as specified.

### Placeholders the client must replace

| What | Current value |
|---|---|
| Address | Placeholder Road, Weligama 81700, Sri Lanka |
| Phone | +94 77 000 0000 |
| Email | stay@vyona.lk |
| Instagram | @vyona.weligama |
| Room prices | $85 / $95 / $110 / $95 / $140 / $120 / $105 per night |
| Room capacity, beds, sizes | invented, plausible |
| Room-to-photo pairing | best guess from the 59 photos |
| LKR rate | flat 300 per USD |
| Availability | generated, not real |

### Missing assets

- No beach or surf photo (the template has one in "Explore Weligama"); a villa photo stands in.
- No hero video yet — the hero keeps a `<video>` slot for it.
- No `.glb` of the villa; the 3D scene is built in code. Draco pipeline is described in the README
  for when a real model exists.
- The supplied photos are WhatsApp-compressed to ~1200px. Originals would noticeably sharpen the
  hero.

### Next

1. Send `.dist/vyona-prototype.html` to the client (it works offline, opens from WhatsApp or email).
2. Collect feedback on copy, room details, prices and photo choices.
3. Only then start Phase 1: Next.js monorepo (web, admin, api), Postgres + Prisma, Redis/BullMQ,
   Booking.com ARI sync and webhooks, per `docs/booking-engine-spec.md`.
