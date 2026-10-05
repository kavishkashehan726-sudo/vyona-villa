# Development diary

A running handover log, so the work can continue on another machine or in another session.
Newest entry on top. Read [CLAUDE.md](CLAUDE.md) first for the rules and design tokens.

---

## 2026-10-05 — Phase 1 step 4: booking and PayHere

### Done

- **Core:** `payhere.ts` (pure: checkout hash, notify signature check, sandbox/live/mock
  config) and `payments.ts` (start a payment, confirm at the villa, release a hold, apply a
  notify). Queues gained job names, a shared queue helper, and `afterConfirm` / `needsRefund`.
- **API** (route handlers in `apps/web`):
  - `POST /api/bookings` holds a room;
  - `DELETE /api/bookings/[id]` releases it;
  - `POST /api/bookings/[id]/pay` returns a signed PayHere form, or confirms a pay-at-villa
    booking;
  - `POST /api/payhere/notify` verifies and applies PayHere's notify.
- **Mock gateway:** `/book/pay/mock` stands in for PayHere without a merchant account. It's
  development only and verifies the same hash.
- **Widget:**
  - "Review booking" holds the room on the server, and the confirm step shows the server's
    quote and deadline.
  - "Continue to payment" goes to PayHere. Back releases the hold.
  - Phone is now required. Totals show cents.
- **`/book/[ref]`:**
  - confirmed ("See you in Weligama.", how it was paid, check-in and check-out times);
  - held (waits for the notify, or offers "Try paying again");
  - expired (with a refund note if the payment came too late);
  - cancelled.
- **Worker:**
  - sweeps expired holds every minute;
  - sends the guest confirmation, the owner's new-booking email and the owner's refund alert
    through nodemailer (Mailpit in dev).
- `payAtVilla` setting, off by default. `MAIL_FROM` and `NEXT_PUBLIC_SITE_URL` are passed
  through turbo.

### Checked

- Typecheck clean. Core tests 49/49, including:
  - three concurrent notifies → one confirmation;
  - a late failure can't undo a payment;
  - a late payment with the nights free → confirmed;
  - a late payment with the nights taken → refund.
- `next build` passes; bullmq bundles fine.
- End to end in Playwright and Mailpit:
  - book → cancel at the gateway → try again → pay → confirmed page → guest and owner emails;
  - Back releases the hold;
  - the second hold on the same nights gets 409;
  - an expired hold returns 410; pay-at-villa while off returns 400;
  - a late payment after another guest took the nights produces the "Refund needed" email
    and the refund note;
  - the sweep marks the stale hold EXPIRED;
  - a `<script>` guest name is escaped in both emails.
- 320 and 390 px: no horizontal scroll, and no console errors or server errors.

### Problems hit

- The `expireHolds` test expected zero holds globally, but the payments tests leave holds behind.
  It now checks its own reservation, and core test files run serially.
- The confirmed page said "Paid by card: $338" for a US$337.70 charge, because prices round to
  whole dollars. Totals and amounts charged now always show cents.
- `PaymentStatus` first took a prop named `ref`, which React reserves.
- At 320 px "Check-out" broke mid-word in the booking summary. The labels no longer wrap.

### Next

- Step 5, admin: login, the room × date grid (blocks, prices), rate rules and settings
  (including `payAtVilla` and the charge currency), the reservations list with cancel and
  manual bookings, and photo upload.
- A local `.env` (gitignored) sets `ADMIN_EMAIL=owner@vyona.test` so the owner emails reach
  Mailpit.

---

## 2026-10-05 — Phase 1 step 3: public site

### Done

- Every prototype section is ported to `apps/web` as server components, with the client's
  feedback: hero copy and script, the new nav, the seven rooms in the new order with
  `[icon] 1 - DHARA` titles, and Explore's three columns.
- New pages: `/stay` (the client's Stay copy word for word, "In every room", "A room, and a
  little more"), `/stay/[slug]` (photos, specs, booking calendar for that room, the other rooms,
  `HotelRoom` JSON-LD), `/explore` and `/explore/{vyona,food,beyond}`, `/about` (placeholder
  structure), `/gallery`, `/contact`, `/book` (`?room=` preselects) and `/book/[ref]` (status,
  room, dates, guests and total; no guest name or email; noindex).
- Photos: `pnpm media:import` turns `images/` into WebP plus a 24px placeholder on the `Media`
  row; `/media/…` serves them. The prototype's blur-up loader is reused, not `next/image`.
- The booking widget reads real nights from `/api/calendar` (state, price, min stay). The
  confirm step is still a mock until step 4.
- Every frontend-guide effect runs: 3D villa with GLSL water, Ken Burns hero, parallax and
  unveils, liquid ripple, magnetic buttons, custom cursor, blur-up, and the `?lite=1` slider
  fallback. The checklist in CLAUDE.md now lists both prototype and web files.
- Favicon from the brand mark (`app/icon.svg`, thicker strokes so it reads at 16px).

### Checked

- Typecheck clean across the monorepo.
- Playwright on all pages at 320, 390, 768, 1440 and 2560: no horizontal scroll, no console
  errors or warnings. Room dialog, booking drawer, 3D canvas, `has-cursor` / `has-ripple`, and
  the lite slider all work. Unknown room, pillar and booking ref return 404.

### Problems hit

- GSAP warned "target not found" on every page hero (no script, rail or dots there). The intro
  now skips empty steps.
- The footer squeezed into two columns on phones: the mobile nav's `.brand { grid-column: 2 }`
  also matched the footer brand. Scoped to `.nav__inner`.
- The nav's "Book your stay" label was ink on olive, because `.nav__links a` sets the colour.
- three r186 dropped `PCFSoftShadowMap`; switched to `PCFShadowMap`.

### Next

Step 4: real holds from the confirm step (`holdRoom`), PayHere sandbox checkout and notify,
the confirmation page and email, and hold expiry in the worker.

---

## 2026-10-05 — Phase 1 step 2: pricing, availability, holds

### Done

- `packages/core`: `dates` (epoch days, the villa's own "today" in Asia/Colombo), `pricing`
  (`nightlyRate`, `quote`), `settings` (rules and settings from the database, with defaults),
  `availability` (`checkStay`, `dayState`, `roomCalendar`, `searchStay`) and `booking`
  (`holdRoom`, `expireHolds`, `BookingError`).
- Nightly rates match the prototype for every night of a year at every room price (tested). The
  discount and service charge are now exact to the cent; the prototype rounded them to dollars.
- `holdRoom` locks the room's nights in date order, takes over holds that ran out, enforces min
  stay and blocks, and writes the quote into the reservation's breakdown.
- 19 tests: pricing parity, quotes, date edge cases, and integration tests on `vyona_test`,
  including 20 simultaneous holds giving exactly one success, and overlapping stays racing
  without sharing a night.

### Bug the tests caught

The first version locked and read in one statement (`… LEFT JOIN "Reservation" … FOR UPDATE OF
d`). All 20 parallel holds succeeded once the night rows already existed: the waiting statement
re-read the locked row but joined against its old snapshot, where the winning reservation did
not exist. Locking and reading are now two statements. The race test runs both with fresh rows
and with existing rows, and fails when the lock is removed (checked).

### Next

Step 3: port the prototype's public site to `apps/web`, section by section, with the client's
feedback and every frontend-guide effect.

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
