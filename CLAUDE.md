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
  1 scaffold ✓ · 2 core ✓ · 3 public site ✓ · 4 booking +
  PayHere ✓ · 5 admin ✓ · 6 Beds24 ✓ · 7 production (PM2 release, deploy script, backups
  ready; the first deploy waits on the server setup in `deploy/README.md`). Client feedback
  lives in `client updates/`
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
    src/app/        pages: / /stay /stay/[slug] /explore /explore/[pillar] /about /gallery
                    /contact /book /book/[ref] /book/pay/mock; media/[...path] serves .media/
    src/app/api/    calendar; bookings (POST hold), bookings/[id] (DELETE release),
                    bookings/[id]/pay; payhere/notify; payhere/mock (test gateway's form);
                    webhooks/beds24 (key-checked, queues a pull of the named booking)
    src/components/ server sections (sections/*), Photo, Nav, Footer, BookBar, RoomDialog,
                    PaymentStatus, Runtime (global effects, once), PageEffects (per page)
    src/client/     the prototype's js/ ported to TS: booking, hero, motion, ripple, cursor,
                    magnetic, villa3d + water, gallery, images, capability, store, boot;
                    checkout (API calls, PayHere form post, hold id in sessionStorage)
    src/lib/        site.ts + media.ts (server only, Prisma); booking.ts (request parsing,
                    error responses, hold rate limit), payhere.ts (notify → queue);
                    rooms, content, gallery, villa (pure data, safe in client code)
  admin/            Next 16 dashboard, admin.vyonaweligama.com (:3001)
    src/app/(desk)/ page.tsx (calendar), reservations (list, [id] + MoveForm, new), rates,
                    photos, settings, channel (Booking.com: link rooms, sync now, log, and
                    in test mode "be a Booking.com guest"); each folder's actions.ts holds
                    its server actions
    src/app/        login/, media/[...path] (serves .media/), api/health, icon.svg
    src/components/ ActionForm (+ Submit), Chart (calendar grid + selection panel),
                    GuestFields, StayFields, JumpTo, Nav
    src/lib/        session (requireAdmin, cookie), actions (attempt → Result), sync (queue
                    calls), throttle (login lockout), format
    src/proxy.ts    cookie gate; requireAdmin() does the real check
  worker/           BullMQ worker: hold expiry sweep (every minute), emails (mail.ts),
                    Beds24 sync queue (concurrency 1): ARI push, booking push/cancel, pull,
                    10-minute poll, full ARI daily at 03:30 Asia/Colombo
packages/
  db/               Prisma 7 schema, migrations, idempotent seed (seed-data.ts = client brief),
                    password (scrypt), photo (convertPhoto: WebP + LQIP, shared by
                    media:import and admin uploads)
  core/             pricing, availability, booking (hold), payments (pay, confirm, release,
                    notify), payhere (hash, verify; pure), queues (names, afterConfirm,
                    afterMove/Cancel/ManualBooking/RatesChange), nights (shared lock + expire),
                    admin (grid, setNights, manual booking, move, cancel), auth (sessions),
                    beds24/ (types, http client for API v2, mock on Redis, mode switch),
                    channel (pushAri, pushBooking, importBooking, pullBooking, pollBookings)
  ui/               tokens.css (Tailwind 4 @theme), icons.tsx, logo.tsx (swap point for the
                    official logo)
docker/             dev.Dockerfile (development only; production runs under PM2)
deploy/             ecosystem.config.cjs (PM2), backup.sh, watchdog.sh, env.example, README
                    (server runbook)
.github/workflows/  ci.yml: typecheck, test, build against postgres + redis services; on main,
                    the `vyona-release` artifact
brand/              vyona-logo.svg, vyona-mark.svg (redrawn from the template nav logo)
docs/               specs + screenshots for the README
scripts/            deploy.sh (prototype), build-release.sh + deploy-app.sh (Phase 1),
                    deploy.env.example (deploy.env is gitignored)
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
docker compose run --rm sh pnpm media:import   # images/ → .media/*.webp + Media rows (also on start)
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

**Phase 1** (runbook: [deploy/README.md](deploy/README.md)) runs under **PM2** as the site user,
with Postgres 17 and Redis installed on the server. CI's `release` job (main only) runs
`pnpm build` and `scripts/build-release.sh`, and keeps `vyona-release` (a tarball) for 30 days.
`scripts/deploy-app.sh` finds the newest green run with `gh` and gets a signed download link for
its artifact (valid about a minute; no GitHub token on the server). The server fetches it with
`curl -K -` (the URL stays out of `ps`) and unpacks it into `releases/<sha>`, rsync
`--link-dest` against `current`. Through the owner's connection the same download ran at
40 KB/s; on the server it takes seconds. It then
runs migrate, seed and photo import, switches `current`, deletes and starts the PM2 apps, and waits
for both `/api/health`. The newest three releases are kept. `--tag <sha>` deploys one build
(rolling back to a release still on the server skips migrations). `--images` uploads the
photos, `--backups` pulls `backups/` down, `--status` shows PM2 and health, and `--restart`
restarts the apps (after an `.env` edit). The server's
`.env` (from `deploy/env.example`) is written by hand and never leaves the server.

- **The VPS is shared** with about twenty other CloudPanel sites (Debian 13, OpenSSL 3.5,
  7.7 GB RAM). Ports 3000–3012 are taken, so VYONA uses `WEB_PORT=3020` and `ADMIN_PORT=3021`.
  Debian's Postgres 17 and Redis were already installed. Redis is shared and already
  `noeviction`, with no AOF; another app's BullMQ lives in database 0, so VYONA uses
  `redis://…/5`. Don't change the shared Postgres or Redis settings. The site user's
  Node 24 and PM2 7 come from its own nvm; the system's Node 22 and PM2 6 belong to the other
  sites.
- **Self-healing:** PM2 restarts crashed apps. `deploy/watchdog.sh` runs from the site user's
  crontab at `@reboot` and every 5 minutes: when fewer than three apps are online or a port
  doesn't answer (twice, 30 s apart), it deletes the apps, kills any untracked holder of the
  ports and starts them again. A 503 counts as answering (DB or Redis down; the apps reconnect).
  It shares `.deploy.lock` with `deploy-app.sh`'s restart and logs only when it acts.
  No root `pm2 startup` unit, unlike the other sites on the server.
- Needs from the owner of the server: Postgres 17 and Redis (noeviction, appendonly) installed
  by root, Node 24 (nvm) and PM2 for the site user, the crontab (watchdog at boot and every
  5 minutes, nightly backup), the two CloudPanel reverse-proxy sites and `client_max_body_size 16m` on
  the admin vhost.
- Indexing is `SITE_INDEXABLE=1` in the server's `.env`, read at run time by the layout's
  `robots` and `app/robots.ts`; `deploy-app.sh --restart`, no rebuild.
- Backups: `backup.sh` from the site user's crontab at 02:30 (the VPS clock is Colombo time):
  `pg_dump -Fc` kept 14 days, a photo tarball kept 3, files mode 600.

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

- Hosting: same VPS, **PM2, not Docker** (switched in step 7). Docker would have put the site
  user in the root-equivalent `docker` group and cost about 1.5 GB of images on a disk that is
  85% full. The release is built in CI, never on the VPS (RAM is tight). CloudPanel
  reverse-proxies the apex → :3020 and the admin subdomain → :3021. Development stays in Docker.
- The release (`scripts/build-release.sh`, on glibc like the server):
  - web and admin are Next standalone output (`node apps/<app>/server.js`);
  - the worker, the seed and the photo import are esbuild bundles. Prisma 7's query compiler is
    inlined as base64 WASM, so they need no node_modules;
  - `db/node_modules` holds only the Prisma CLI (for `migrate deploy`) and sharp: 271 MB,
    mostly Studio's dependencies, which `--link-dest` stores once across releases;
  - `NEXT_PUBLIC_SITE_URL` is set in the CI job, because Next inlines it.
- PM2 (`deploy/ecosystem.config.cjs`, in the app folder): secrets reach Node through
  `--env-file=.env`, so they stay out of PM2's dump. The fixed settings in the ecosystem win,
  because `--env-file` never overrides a set variable. Apps listen on 127.0.0.1. Script paths go
  through `current`, so crash restarts and `pm2 resurrect` never run a pruned release.
- Memory: web and admin heap 256 MB, restarted above 384; worker 192/256. Postgres
  `shared_buffers` 64 MB and 40 connections; Redis maxmemory 64 MB with noeviction (BullMQ).
  pm2-logrotate keeps 3 × 10 MB.
- The API lives in Next route handlers in `apps/web`, not a separate service (one fewer container).
- Payments: **PayHere** (sandbox until the merchant account exists).
- Booking.com: **through Beds24** API v2, behind an adapter that is mocked until the client has an
  account.
- Money in integer cents, USD. `RoomDay` holds one row per room per night, created on demand and
  locked with `SELECT … FOR UPDATE` for holds.
- Logo: the redrawn SVG in `packages/ui/src/logo.tsx` until the official file arrives.
- Client reference images are for layout only; use the real photos, with a slot for a beach shot.
- Photos are not `next/image`: `media:import` makes WebP (1200px, q60, as the prototype) plus a
  24px LQIP on the `Media` row, `/media/…` serves them with a one-year cache, and `Photo` renders
  the prototype's blur-up `<img class="blur-img" data-img>`. Same CLS and blur, no optimiser on a
  memory-tight VPS.
- The mobile booking sheet is the prototype's own drawer (`[data-drawer]` in the layout), not
  vaul. Book buttons are `<Link href="/book" data-open-booking>`: `client/booking.ts` intercepts
  them in the capture phase, so without JS they still reach the /book page.
- Pages are server components. The layout inlines `#vy-boot` (photos, room summaries, booking
  settings) as JSON; client code reads it with `boot()` instead of fetching.
- `Runtime` (in the layout) starts global effects once: images, cursor, magnetic, ripple, booking.
  `PageEffects` goes last in each page and starts/stops hero, motion, gallery, map and the 3D
  villa, so they rebind on client navigation.
- Client components import from `@/lib/rooms`, never `@/lib/site` (which pulls in Prisma).
- **Checkout flow.** "Review booking" holds the room (POST /api/bookings). The confirm step
  shows the server's quote and deadline. "Continue to payment" opens a fresh Payment
  (`${ref}-N`, one per attempt) and posts a signed form to PayHere, which returns the guest to
  `/book/[ref]?payment=done|cancelled`. Only the notify confirms. `PaymentStatus` refreshes the
  page for 90 s while it waits, and offers "Try paying again" after a cancel. Back from the
  confirm step releases the hold.
- **The reservation id (cuid) is the secret** for paying and releasing. It is never rendered;
  the widget keeps it in sessionStorage (`vy-hold:<ref>`). The ref is public, so `/book/[ref]`
  shows no guest name or email.
- **Mock gateway:** without PayHere credentials and outside production, checkout goes to
  `/book/pay/mock`, which verifies the hash and signs a notify like PayHere's. In production
  without credentials, card payment returns 503. `/api/payhere/notify` is 404 in mock mode.
- **Notify handling:** the Payment row is locked first, so retried notifies are idempotent. A
  late cancel or failure never undoes PAID. A payment that lands after its hold expired takes the
  nights back if they are free; otherwise the owner gets a "Refund needed" email.
- **`payAtVilla` setting** (default off): when on, the confirm step offers "At the villa on
  arrival", recorded as a `VILLA` Payment.
- Phone is required (PayHere needs it); PayHere's address and city get "Not provided".
- Holds are rate-limited in memory: 8 per IP per 15 minutes (cf-connecting-ip first).
- Emails go from the worker via nodemailer: guest confirmation, owner booking and owner refund,
  to `ADMIN_EMAIL`. Mailpit catches them in dev. Guest input is HTML-escaped.
- **Admin auth is hand-rolled, not Auth.js** (`core/auth.ts`): a random token in an httpOnly
  cookie (`vy_admin` in dev, `__Host-vy_admin` in production), only its SHA-256 in
  `AdminSession`, 14 days, ended by sign-out or a password change. scrypt hashes. The first
  admin is created once by the seed from `ADMIN_EMAIL`/`ADMIN_PASSWORD` and never overwritten.
  Five failed sign-ins per email or IP in 15 minutes lock both out (in memory).
- **Admin UI is hand-built CSS** on the shared tokens (`apps/admin/src/app/globals.css`), not
  shadcn. Mobile tables become labelled cards; the photo strip scrolls sideways under 700px.
- **ActionForm** submits from `onSubmit` in `startTransition`, not through the form's action,
  so React 19's post-action reset doesn't wipe what the owner typed. A form that disappears
  after its action (cancel, delete) redirects with `?saved=…` and the page shows the banner.
- **Calendar selection:** drag or shift-click with a mouse, first and last night with two taps
  on touch, Enter and the arrow keys from the keyboard; Esc closes the panel.
- Owner changes queue Booking.com sync through `lib/sync`, which logs and swallows queue
  errors: a save never fails because Redis is down, and the fallback sync catches up.
- A move doesn't email the guest; a cancel or manual booking emails only if ticked.
- Uploads: JPEG/PNG/WebP up to 15 MB (server action body limit 16 MB); HEIC is refused.
  The seed creates photos only if missing, and `media:import` keeps files replaced in the admin.
- Owner emails link to the booking in the admin via `ADMIN_URL`.
- **Beds24 mode** (`beds24Mode()`): `beds24` when `BEDS24_REFRESH_TOKEN` is set, `mock` without
  it outside production (a stand-in on Redis, `b24mock:*` keys), `off` in production without it.
  The webhook needs `?key=BEDS24_WEBHOOK_SECRET`; without a secret it answers only in mock mode.
- **Out to Beds24:** each linked room's price, min stay and closed nights as calendar ranges;
  closed nights and inactive rooms go as `override: 'blackout'`. Raw `numAvail` is **never**
  pushed, so it can't reopen a Booking.com sale we haven't pulled yet. Confirmed DIRECT/MANUAL
  bookings become Beds24 bookings (`apiReference` = our ref, found again by reference), so Beds24
  closes their nights itself. Holds are not pushed. A move to an unlinked room cancels it there.
- **In from Beds24:** webhook → `beds24-pull` job → fetch by id → `importBooking`, idempotent by
  `externalId`. Bookings carrying one of our refs are skipped (`ours`); unlinked rooms are logged
  as errors. An import expires live HOLDs on its nights (the late payer gets the refund path) but
  never takes nights from a CONFIRMED booking: it is saved anyway, logged as `conflict`, and the
  owner gets an "Overbooked" email once per booking and stay. `reclaimNights` hands the nights
  over when the other booking moves or is cancelled.
- The poll checkpoint (`Setting beds24.polledAt`) moves only when the whole poll succeeds.
- Every exchange writes a `SyncLog` row; the admin's Booking.com page shows them, hiding quiet
  polls and fetches. An import that changes nothing (our own booking, a replay, a clash already
  reported) is logged as `seen`, hidden and not counted as a problem.
- The test-mode sales table refreshes itself once (`RefreshSoon`) while a sale is still
  "Arriving…": the worker imports it after the action has already revalidated.
- Totals and amounts charged show cents (`exact` in `formatMoney`, `<Price exact>`), so the
  page matches the card statement. Nightly prices stay rounded.

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
- Prototype booking is a mock (FNV hash of the date). In `apps/web` the calendar is real:
  `/api/calendar` returns each night's state, price and min stay from `packages/core`. Nightly rate
  +20% Dec–Mar, +12% Fri/Sat; 10% service charge; 10% off at 7+ nights; 15-minute hold.
- About and the Explore pillar pages carry draft or placeholder copy, marked on the page.
- Contact details, address and social handles are placeholders, marked on the page.

## Frontend guide checklist (live in the prototype and in `apps/web`)

Prototype paths are under `prototype/src/js/`; web paths under `apps/web/src/client/`.

| Guide item | Prototype | apps/web |
|---|---|---|
| 3D villa, orbit limits (polar π/4–π/2.1, distance 8–25, no pan) | `villa3d.js` | `villa3d.ts` (dynamic import) |
| Raycast hover glow + "✨ Name · Tap to inspect" tag, click → camera fly + info card | `villa3d.js` | `villa3d.ts` |
| Custom GLSL water (waves, fresnel, caustics, sun glint, hover glow) | `water.*.glsl` | `water.ts` |
| Cinematic hero (Ken Burns cross-fade, `<video>` slot kept for later) | `hero.js` | `hero.ts`, `sections/Hero.tsx` |
| Deep parallax + scroll masking (scaleY unveils) | `motion.js` | `motion.ts`, `.unveil` |
| Liquid hover: one shared WebGL canvas moved over the hovered image | `ripple.js` | `ripple.ts` |
| Magnetic buttons (pull /3, spring 150/15/0.1) + custom cursor | `magnetic.js`, `cursor.js` | same, `.ts` |
| Blur-up loading, fixed aspect boxes (low CLS) | `images.js` | `images.ts`, `components/Photo.tsx` |
| Capability check → photo-slider fallback, no ripple/cursor | `capability.js` | `capability.ts` (`?lite=1` / `?full=1`) |
| Transform/opacity-only animation, reduced motion respected | throughout | throughout |
| SEO meta + JSON-LD `LodgingBusiness` / `HotelRoom` | `index.html` | `app/layout.tsx`, `app/stay/[slug]` |
| Draco pipeline for the real `.glb` | README, not used yet | not used yet |

## Gotchas

- **Never `pm2 reload` or `pm2 restart` the apps** (PM2 7, fork mode). When the old process's
  exit event lands after the new start has begun, PM2 takes it for a crash and starts a second
  copy it no longer tracks: it holds the port and the tracked app loops on `EADDRINUSE` until
  `errored`. Seen in 3 of 37 test reloads, each soon after the apps had started.
  `deploy-app.sh` deletes and starts (a late exit for a deleted app is ignored); `--restart`
  does the same by hand.
- **Lock and read in separate statements.** Under READ COMMITTED a `SELECT … FOR UPDATE` that
  waited for a lock re-reads the locked row but joins against its old snapshot, so it misses the
  winner's new reservation. `holdRoom` locks with one statement and reads with the next. The
  concurrency test pre-creates the RoomDay rows, because fresh rows are serialised by the
  primary-key insert instead and hide this bug.
- **Lock order: Payment → RoomDay → Reservation**, in every transaction (holdRoom, expireHolds,
  confirm, release, notify). Any other order can deadlock against the expiry sweep.
- BullMQ custom job ids may not contain `:`. Ids are deterministic (`guest-<id>`,
  `refund-<orderId>`) and completed jobs are kept 7 days, so a retried notify sends nothing twice.
- Core test files use their own room numbers (channel 600+, admin 700+, payments 800+,
  booking 900+): `Room.number` is unique and the test DB is truncated once per run. A fresh
  `Beds24Mock` restarts its ids, so each channel test seeds `b24mock:seq` with its own range.
- Core test files run one at a time (`fileParallelism: false`): `expireHolds` sweeps every room,
  so a parallel file would expire another file's holds.
- Turbo strips `MAIL_FROM` and `NEXT_PUBLIC_SITE_URL` from the worker unless they are in
  `globalPassThroughEnv` (Next apps get `NEXT_PUBLIC_*` by inference, plain Node apps don't).
- Everything exported from a `'use server'` file is a callable endpoint. Helpers go in `lib/`.
- `path.resolve(process.env.MEDIA_DIR …)` makes Turbopack trace the whole project; the media
  routes and photo actions carry `/*turbopackIgnore: true*/`.
- `docker compose restart` doesn't re-read `.env`; use `docker compose up -d app`.
- Next's route announcer also has `role="alert"`; scope test selectors to `.note`.
- `.table__main` on an `<a>` is a stretched link: its `::after` covers the whole row. Plain-text
  names use a `<span className="table__main">`, which has no overlay, so row buttons stay clickable.
- Playwright MCP intercepts `confirm()` and stops the script: register `page.once('dialog')`
  before the click.
- Per-night state (price, blocked, minStay, reservation) is the `RoomDay` table; there is no
  DayOverride table despite the plan.
- `ref` is a reserved React prop: `PaymentStatus` takes `bookingRef`.
- Core tests run against a `vyona_test` database that `packages/core/test/global-setup.ts`
  creates, migrates and truncates; the dev data is never touched.

- **Turbo 2 runs tasks in strict env mode**: any variable not listed in `turbo.json` is stripped.
  Runtime secrets go in `globalPassThroughEnv`, or Prisma silently falls back to localhost and
  fails with `ECONNREFUSED`.
- `pnpm --filter x deploy` runs pnpm's built-in `deploy`, not the script. Use `run`.
- Prisma 7: the datasource URL lives in `prisma.config.ts`, the client is generated into
  `packages/db/src/generated` (gitignored), and it connects through `@prisma/adapter-pg`.
- BullMQ 6 needs a constructed ioredis client (`createRedis()` in core), not connection options.
- Next 16: `middleware` is now `proxy.ts`, and route params are async.
- The nav is fixed and the hero has `margin-top: var(--nav-h)`. A page without a hero starts
  with `<div className="page-top" />` or its top sits under the nav.
- Mobile-nav rules must be scoped to `.nav__inner`: a bare `.brand { grid-column: 2 }` also hit
  the footer brand and pushed the footer into two cramped columns.
- `.nav__links a` sets the link colour, so the nav's olive button needs its own `color` rule.
- GSAP warns "target not found" for every empty selector. Page heroes lack the home hero's
  script, rail and dots, so `initHero` skips intro steps with nothing to animate.
- three r186 removed `PCFSoftShadowMap` (it falls back with a warning); use `PCFShadowMap`.

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

Whether guests may pay at the villa (`payAtVilla`), the PayHere charge currency (USD or LKR),
official logo, Tara's keywords, whether the Booking.com rate is the nightly rate or includes
the service charge or a markup, the Beds24 room ids (and a check of blackout against the real
account), About copy and host photos, Explore subpage copy, real contact
details and address, high-res photos (beach, food, video), PayHere merchant account, Beds24
account, SMTP provider, tax and service-charge rules, check-in/out times, cancellation policy.
Placeholders are marked on the page; nothing blocks on these.
