# Development diary

A running handover log, so the work can continue on another machine or in another session.
Newest entry on top. Read [CLAUDE.md](CLAUDE.md) first for the rules and design tokens.

---

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
