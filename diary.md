# Development diary

A running handover log, so the work can continue on another machine or in another session.
Newest entry on top. Read [CLAUDE.md](CLAUDE.md) first for the rules and design tokens.

---

## 2026-10-06 — Cut-over: the real site replaces the prototype

### Done

- Deployed `8006d02` (3D villa off, themed scrollbars, cursor over dialogs) to production.
- The owner edited the apex's CloudPanel vhost to proxy to :3020 (the text is in
  `deploy/README.md`). It stays a static site with an edited vhost: deleting a CloudPanel site
  deletes its user's home, which is `~/app`.
- Deleted the prototype from `htdocs` (`index.html`, `assets/`, `robots.txt`); `.well-known`
  stays for certificate renewals. `scripts/deploy.sh` is retired.
- The preview notice said card payments go to a test gateway, which is only true in
  development. It now follows `payhereConfig()`: no gateway → "Online payment isn't switched
  on yet", sandbox or mock → the test-gateway line, live → nothing.

### Checked

- Through Cloudflare: `/`, `/stay`, `/book`, `/api/health` and `/robots.txt` (Next's, still
  `Disallow: /`) answer 200; www and http 301 to `https://vyonaweligama.com`.
- Playwright on the live home page: no console errors, no failed requests, no 3D section.

### Next

- `SITE_INDEXABLE=1` once real prices are confirmed; the PayHere notify URL and the Beds24
  webhook once those accounts exist.

---

## 2026-10-06 — Client fixes: 3D villa off, scrollbars, cursor over dialogs

### Done

- The client asked to take the 3D villa section down for now. In `apps/web` it sits behind
  `SHOW_VILLA_3D = false` (`lib/villa.ts`), which drops the home section and the mobile-menu
  link; nothing else changed, so turning it back on is one line. In the prototype the section
  and menu item are `hidden` and the `initVilla` import is commented out, so three.js leaves the
  bundle (the web build went from 0.93 MB to 420 KB). The Welcome "Our story" link pointed at
  `#villa3d`; it now goes to `#experiences`.
- Thin scrollbars in the page's taupe, everywhere: the page, the booking sheet, the room
  dialog, and the admin. Safari gets a `::-webkit-scrollbar` fallback.
- The custom cursor disappeared over the room dialog and the lightbox, because modal dialogs
  render in the top layer. The cursor is now a manual popover, re-shown after a modal opens.

### Checked

- `pnpm typecheck` passes; the prototype `build:web` has no three.js left.
- Playwright on the prototype build and on dev `apps/web` (`?full=1`): no 3D section or menu
  link, `scrollbar-width: thin` on the page, the drawer and the dialog, the cursor open and
  visible over the room dialog, no page errors. In dev, Turbopack still loads the 744-byte
  villa3d loader stub, but never three.js itself.

### Next

- Deploy the prototype (`./scripts/deploy.sh --build`) once the owner says so, and push so
  `apps/web` picks it up on the next app deploy.

---

## 2026-10-06 — First production deploy and self-healing

### Done

- The owner did the server setup: the `vyona` Postgres role and database, the proxied `admin`
  DNS record, and the CloudPanel reverse-proxy site with its Let's Encrypt certificate and
  `client_max_body_size 16m`. The server's `.env` uses the dev admin login until the real email
  address exists.
- First deploy of `27a77c9`: two migrations, the seed (7 rooms, 2 rate rules, the admin), 49
  photos. The admin answers at https://admin.vyonaweligama.com; the public site runs on :3020
  behind no proxy yet, so the prototype stays at the apex.
- `deploy/watchdog.sh`, from the site user's crontab at `@reboot` and every 5 minutes, replaces
  `@reboot pm2 resurrect`. When fewer than three apps are online or a port doesn't answer,
  twice 30 s apart, it deletes the apps, stops any untracked holder of the ports and starts them
  again. It logs only when it acts. `deploy-app.sh` uploads it, and its restart takes the same
  `.deploy.lock`.
- The runbook has a *Self-healing* table: what fails and what brings it back.
- `deploy-app.sh` no longer downloads the release here and uploads it. It asks GitHub for the
  artifact's signed download link (valid about a minute) and the server fetches it, with the URL
  passed to `curl -K -` on stdin so it stays out of `ps` on the shared server. Unpacking goes
  through `rsync --link-dest` against `current`, as before.

### Checked

- Through Cloudflare: `/login` 200, `/api/health` 200, the sign-in page renders.
- Postgres, Redis, nginx and cron are enabled at boot; all three apps online, no watchdog log.
- The server-side fetch of `27a77c9` into a scratch folder: 23 s end to end, identical to the
  deployed release except two runtime caches, all 13,369 files hard links to it.
- Not run: the break-and-heal tests (SIGKILL, `pm2 kill`, a simulated reboot, stopped apps, an
  untracked copy on the admin port). Killing the production apps was refused by the
  permission check; the owner can run them.

### Problems hit

- The server clock is Colombo time (`+0530`), not UTC: the backup line is `30 2 * * *`.
- `gh run download` from the owner's connection ran at about 40 KB/s: half an hour for the
  release, before uploading 396 MB of it again. The server fetched the same artifact in 3 s
  from a signed URL.

### Next

- Cut-over once the client signs off; change the admin login once the real email exists.

---

## 2026-10-06 — Phase 1 step 7: production under PM2

### Done

- Built the Docker version first: three images for GHCR and a compose stack with Postgres, Redis
  and a backup container. Then switched to **PM2**, at the owner's request. Docker would have
  put the site user in the root-equivalent `docker` group and needed about 1.5 GB of images on
  a disk that is 85% full. CloudPanel runs Node sites with PM2 anyway. Development stays in
  Docker.
- `scripts/build-release.sh` assembles the release after `pnpm build`:
  - web and admin as Next standalone;
  - the worker, the seed and the photo import as esbuild bundles;
  - `db/` with the migrations and a node_modules holding only the Prisma CLI and sharp.
  It refuses to pack `.env` files or photos, because the artifact is public.
- CI `release` job (main only): build, assemble, upload `vyona-release` for 30 days.
- `deploy/ecosystem.config.cjs` defines three PM2 apps on 127.0.0.1:
  - script paths go through `current`;
  - secrets come in through Node's `--env-file`;
  - heap caps plus `max_memory_restart`, and exponential back-off for a crash loop;
  - a 15 s kill timeout so the worker can close its queues.
- `scripts/deploy-app.sh`: picks the newest green run with `gh`, downloads the release, rsyncs it
  with `--link-dest` against `current`, then migrate → seed → photo import, switch, delete
  and start the PM2 apps, health, keep three releases. `--tag` rolls back without migrating when that
  release is still on the server.
- `deploy/backup.sh` runs from the site user's crontab. The password goes to `pg_dump` through
  `PG*` variables, not the command line. The files are mode 600.
- `deploy/README.md` covers:
  - the root steps (Postgres 17 from PGDG, Redis settings);
  - nvm, PM2 and pm2-logrotate;
  - the crontab (`@reboot pm2 resurrect`, the backup);
  - CloudPanel, `.env`, deploys, rollback, logs, backups and the cut-over.
- Indexing is now `SITE_INDEXABLE`, read at run time. It was `NEXT_PUBLIC_INDEXABLE`, which
  Next would bake into the build. The new `app/robots.ts` follows the same switch.
- `mail.ts` treats an empty `SMTP_URL` like a missing one.

### Problems hit

- `pnpm fetch` fills node_modules with the whole lockfile, which made the Docker worker image
  1.47 GB. That was the first sign the Docker images were heavy for this server.
- The Prisma CLI needs 271 MB, mostly Studio's dependencies, only for `migrate deploy`.
  Hard links through `--link-dest` mean it is stored and uploaded only when its version changes.
- **`pm2 reload` can start an app twice.** In fork mode a reload is a stop then a start. When the
  old process's exit event arrives after the start has begun, PM2 takes it for a crash and starts
  another copy, which it then loses track of. That copy holds the port, and the tracked app loops
  on `EADDRINUSE` until PM2 marks it `errored` (admin: 17 restarts). It happened in 3 of 37 test
  reloads, and dropping `exp_backoff_restart_delay` didn't stop it. PM2's source confirms the
  race. Deploys now `pm2 delete` and then `pm2 start`, because the exit event of a deleted app is
  ignored. `--restart` does the same after an `.env` edit.
- The ecosystem's script paths go through `current/…`, so a crash restart or `pm2 resurrect`
  never runs a release that has been pruned.
- Non-interactive ssh skips the nvm lines in `.bashrc`, so `deploy-app.sh` sources `nvm.sh` itself.
- A rejected local test of the Docker stack had partly run: its Postgres and Redis containers
  were still up, restarting on boot. Removed them, their volumes and the `ghcr.io/local` tags.

### Checked

- `pnpm typecheck` clean; `bash -n` on both scripts, `sh -n` on `backup.sh`.
- Built the release the way CI does, in Debian Node 24 (glibc): 396 MB, a 107 MB tarball.
- Ran it under PM2 7 as an unprivileged user against Postgres 17 and Redis 7:
  - migrate, seed and photo import, run twice to show they're idempotent;
  - web and admin `/api/health` 200;
  - `/`, `/stay`, `/stay/jala`, `/explore`, `/book`, `/api/calendar`, admin `/login`, a static
    chunk and an imported photo all 200;
  - `robots.txt` is `Disallow: /` and the page carries `noindex` while `SITE_INDEXABLE=0`;
  - both ports listen on 127.0.0.1 only;
  - the admin password is not in `dump.pm2`;
  - memory after start: web and admin about 110–140 MB each, worker about 130 MB.
- Three deploys in a row with delete and start: each healthy in 2 s, three processes, the worker
  started once per deploy, no errors.
- Postgres and Redis unreachable: all three apps stay online with no restarts, and health
  answers 503.
- `backup.sh` with Postgres 17's `pg_dump`: reads a quoted `DATABASE_URL`, writes mode-600
  files, the dump lists all 11 tables, and a second run the same day replaces the first.
- Not run against the real VPS: it waits on the root steps in `deploy/README.md`.

### Next

- On the server: the root steps (Postgres 17, Redis), Node 24 and PM2 for the site user, the
  crontab, the CloudPanel sites and `.env`. Then push, wait for CI and run
  `scripts/deploy-app.sh --images`.
- The worker logs Node's `url.parse()` deprecation warning (DEP0169) from a dependency.
  It's harmless, but worth tracing when convenient.

---

## 2026-10-05 — Step 6 follow-up: walking `/channel` in the browser

### Done

- The 10-minute poll logged our own bookings as "Booking.com booking received" and logged a
  known overbooking again on every pass, which doubled the problem count. Imports that change
  nothing are now `seen`, hidden from the log and from the count (test added).
- "Guest cancels" did nothing: the `.table__main::after` row overlay sat on top of it. The
  overlay now applies only to links.
- After a sale the row said "Arriving…" until a manual reload. `RefreshSoon` refreshes the page
  once, three seconds later, while any sale is still waiting.

### Checked

- In Chrome, as the owner: linking rooms, a sale, a refused repeat sale, a forced overbooking
  (log entry and email), a guest cancel that hands the nights to the waiting booking, and a sale
  that turns into its VY- ref with no reload. No horizontal scroll at 390px.
- Typecheck clean, core tests 87/87.

### Next

- Step 7: production images, compose, backups.

---

## 2026-10-05 — Phase 1 step 6: Booking.com through Beds24

### Done

- **Adapter** (`packages/core/src/beds24/`): one `Beds24` interface with an HTTP client for API
  v2 (refresh token → access token, cached until near expiry, one fresh sign-in on a 401; the
  queue retries other failures) and a mock
  that keeps its calendar and bookings in Redis. The mock can also play Booking.com: `sell`
  refuses closed or taken nights unless forced, and `cancelSale`. `beds24Mode()` picks
  `beds24`, `mock` (no token, not production) or `off` (no token in production).
- **Out** (`channel.ts`): `pushAri` sends price, min stay and closed nights per linked room as
  date ranges, with closed nights and inactive rooms as blackout and never a raw availability
  count. `pushBooking` creates, updates or cancels the Beds24 copy of a confirmed website or
  manual booking, found again by its ref if the id was lost.
- **In:** `/api/webhooks/beds24` checks the key and queues a pull of the named booking.
  `importBooking` applies it by Beds24 id (a replay changes nothing): new, changed dates or
  room, or cancelled. It expires holds on those nights but never takes nights from a confirmed
  booking. It records the clash, emails the owner "Overbooked", and `reclaimNights` hands the
  nights over when the other booking moves or is cancelled.
- **Worker:** a sync queue at concurrency 1 for ARI push, booking push and cancel, pull, a poll
  every 10 minutes (imports what changed and pushes what Beds24 lacks) and the full year of
  prices daily at 03:30 Colombo time. Owner admin changes queue the push through `lib/sync`.
- **Admin `/channel`** ("Booking.com" in the nav): mode, linked rooms, last check and problem
  count; "Check for bookings" and "Send prices now"; Beds24 room ids per room; in test mode a
  form to book as a Booking.com guest (optionally forced over closed or booked nights) with a
  "Guest cancels" button; and the sync log.
- README (status, a Booking.com section, admin bullet) and `.env.example` (the two BEDS24
  variables, explained).

### Checked

- Typecheck clean, core tests 87/87 (19 new in `channel.test.ts`), `next build` clean for web
  and admin.
- Walk-through against the stand-in, driven from a throwaway script and the real webhook route:
  - linking two rooms sent 365 nights of prices;
  - a manual booking reached the stand-in, which then refused to sell over it;
  - a sale arrived through the webhook as a BOOKING_COM reservation, and three replays left one;
  - a forced sale over the manual booking was saved, logged as a conflict, and Mailpit got
    "Overbooked: Dhara, Tue, 4 May 2027";
  - a guest cancel on the stand-in arrived as CANCELLED;
  - bad payloads get 400, GET gets 405.
- Not checked: the admin `/channel` page in a browser. It needs a signed-in session.

### Problems hit

- Each fresh mock restarted its ids, so tests collided with external ids from earlier tests.
  Each test now seeds `b24mock:seq` with its own range.
- Channel tests passed alone but failed in the full suite on a unique `Room.number`: the
  payments tests also used 800+. Channel tests moved to 600+.

### Next

- Sign in and walk `/channel`: link rooms, book as a Booking.com guest, overbook, cancel.
- The dev database keeps the walk-through data: Dhara and Jala linked to Beds24 ids 501 and
  502, and three bookings in April and May 2027 (one cancelled, one overbooked).
- Step 7: production images in GHCR, `compose.prod.yml`, the CloudPanel proxy, backups.
- With a real Beds24 account: set the token, webhook key and room ids, and confirm blackout
  closes nights on Booking.com.

---

## 2026-10-05 — Phase 1 step 5: admin

### Done

- **Sign-in:** custom sessions instead of Auth.js (`packages/core/src/auth.ts`). The cookie
  holds a random token and the `AdminSession` table holds its SHA-256, so a database copy can't
  log anyone in. Sessions last 14 days and end on sign-out or a password change. scrypt hashes
  (`packages/db/src/password.ts`). An unknown email takes as long as a wrong password. Five
  failures per email or per IP in 15 minutes lock both out (`lib/throttle.ts`). `proxy.ts` is a
  cheap cookie gate; `requireAdmin()` checks the session on every page and action.
- **Calendar** (`/`): rooms × 42 nights, four weeks per step, plus a date jump. It shows
  bookings by source, holds, closed nights, custom prices and minimum stays. Today's line
  links to arrivals, departures, in-house guests, guests paying now and refunds due. Select
  nights with a drag or shift-click (mouse), two taps (touch) or Enter and the arrow keys. Then
  close or open them, set a price or a minimum stay, or clear them. Esc closes the panel.
- **Bookings:** nine views (upcoming, arriving today, in house, leaving today, awaiting
  payment, to refund, cancelled, past, all) and a search. The detail page shows the stay, the price breakdown,
  the guest with mailto, tel and WhatsApp links, payments, notes only the owner sees, and the
  guest's editable details. Move changes the dates or room, keeping the price, repricing, or
  taking a custom total. Cancel can email the guest. A manual booking can email a confirmation.
- **Rates:** base rate per room, plus season and weekday rules with month chips.
- **Settings:** service charge, long-stay discount and its threshold, LKR rate, hold minutes,
  `payAtVilla`, and a password change.
- **Photos:** upload (JPEG, PNG or WebP up to 15 MB, converted like `media:import`), alt text,
  per-room order, cover and removal, and deleting a photo from the library. On mobile the
  room strip scrolls sideways.
- **Core:** `admin.ts` (grid, `setNights`, manual booking, move, cancel, admin quote) and
  `nights.ts` (locking shared with `holdRoom`). New queue helpers `afterManualBooking`,
  `afterMove`, `afterCancel` and `afterRatesChange` prepare for Beds24. The worker sends a
  cancellation email, and owner emails link to the booking in the admin (`ADMIN_URL`).
- **DB:** migration `admin_sessions` (`AdminSession`, `Reservation.ownerNotes`). The seed
  creates photos only if missing and never overwrites the owner's order. `media:import` keeps
  files that were replaced through the admin. `convertPhoto` is shared by both.
- **README** rewritten for Phase 1: status table, the site, booking and admin, the Docker quick
  start, and the prototype as its own section. The screenshots were retaken from `apps/web` and
  the admin, with demo bookings that were deleted afterwards.

### Checked

- Typecheck clean. Core tests 68/68, including:
  - a manual booking can't take held or booked nights;
  - a move can't land on another guest's nights but may overlap its own;
  - a cancel frees the nights;
  - sign-out ends the session, and a password change signs out the other browsers.
- `next build` is clean for admin and web, with no Turbopack warnings.
- Smoke test in Playwright and Mailpit:
  - sign in with a bad and then a good password;
  - close, price and reopen a range on the calendar;
  - add a manual booking (with its confirmation email);
  - move it (keep, reprice, custom), then cancel it (with its cancellation email);
  - rates, with invalid input, a save, "no change", and adding and deleting a rule;
  - settings, with an invalid value, a save, and changing and restoring the password;
  - photos, with a bad file, upload, reorder, cover, alt text, remove and delete; the public
    room page picked up the change;
  - a `<script>` guest name shows escaped.
- 390 px: no horizontal scroll on any admin page. The test data is cleaned up, with Tara's
  photos restored.

### Problems hit

- React 19 resets a form after its action, which wiped input whenever the server rejected it.
  `ActionForm` now submits from `onSubmit` inside `startTransition`.
- Forms that disappear after their action (cancel, delete) lost their message. They now
  redirect with `?saved=` and the page shows a banner.
- Everything exported from a `'use server'` file becomes a callable endpoint, so helpers live
  in `lib/`.
- Next's route announcer also has `role="alert"`, so tests must scope to `.note`.
- Turbopack traced the whole project from `path.resolve(process.env.MEDIA_DIR)`. Fixed with
  `/*turbopackIgnore: true*/`.
- `docker compose restart` doesn't re-read `.env`. Use `docker compose up -d app`.
- Playwright MCP intercepts `confirm()` dialogs and stops the script, so accept the dialog
  with `page.once('dialog')` before clicking.
- The mobile table's grid let chips stretch and pushed sub-lines into the label column. It
  now uses a padded gutter with absolutely placed labels.

### Next

- Step 6, Beds24: the adapter (a mock until the account exists), the push worker for the
  queued jobs, the webhook and the 10-minute fallback sync.
- The first admin comes from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` (gitignored). The
  seed creates it once and never overwrites it, so a password changed in the admin survives.

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
