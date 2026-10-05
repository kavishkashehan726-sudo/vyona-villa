// Booking widget: Dates -> Details -> Confirm, ported from the prototype.
// The calendar now shows real availability and prices from /api/calendar
// (the SRS states: available / reserved = on hold / booked). The confirm step
// is still a mock until step 4 adds the hold and PayHere: it marks the nights
// booked for this session and nothing leaves the browser.
//
// One widget per page load. It lives in the page's booking section when the
// page has one (mountBooking) and moves into the drawer when a
// [data-open-booking] button is pressed anywhere.

import { DAY_MS, toIso, today } from '@vyona/core/dates';
import { quote } from '@vyona/core/pricing';
import { boot } from './boot';
import { photo } from './images';
import { getCurrency, money, onCurrency, setCurrency, type Currency } from './store';
import { $, $$, esc, lockScroll, toast } from './ui';

// Same limits as @vyona/core/availability, which the browser can't import (it loads Prisma).
const MAX_NIGHTS = 30;
const MAX_ADVANCE_DAYS = 540;

type DayState = 'free' | 'reserved' | 'booked' | 'past';
type Day = { state: DayState; price: number; minStay: number | null };
type Status = DayState | 'loading' | 'closed';

const CHEV = (flip = false) =>
  `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"${
    flip ? ' style="transform:scaleX(-1)"' : ''
  }><path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7"/></svg>`;
const MARK = `<svg viewBox="0 0 100 72" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="50" cy="5" r="3.2" fill="currentColor" stroke="none"/><path d="M19 45 A 34 34 0 0 1 81 45" stroke-width="2.2"/><path d="M50 16 C 58.5 29, 58.5 52, 50 67 C 41.5 52, 41.5 29, 50 16 Z" stroke-width="2.2" stroke-linejoin="round"/><path d="M50 25 C 46.2 36, 46.2 49, 50 59" stroke-width="1.2"/></svg>`;

const COUNTRIES = ['', 'Sri Lanka', 'United Kingdom', 'Germany', 'Australia', 'India', 'France', 'Netherlands', 'United States', 'Russia', 'Other'];
const TIMES = ['12:00', '14:00', '16:00', '18:00', '20:00', 'After 22:00'];
const PICK_IN = 'Choose your check-in date.';

let TODAY = 0;
const toDate = (n: number) => new Date(n * DAY_MS);
const fmt = (n: number, o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  toDate(n).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/* ------------------------------------------------------------ calendar data */

// Per room and month: the nights, a pending fetch, or 'error'.
const months = new Map<string, Map<number, Day> | Promise<void> | 'error'>();
const monthKey = (slug: string, y: number, m: number) => `${slug}:${y}-${m}`;
const ymOf = (n: number) => {
  const d = toDate(n);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
};

function ensureMonth(slug: string, y: number, m: number) {
  const k = monthKey(slug, y, m);
  if (months.has(k)) return;
  const from = Date.UTC(y, m, 1) / DAY_MS;
  const to = Date.UTC(y, m + 1, 1) / DAY_MS;
  if (to <= TODAY || from > TODAY + MAX_ADVANCE_DAYS) {
    months.set(k, new Map());
    return;
  }
  const qs = new URLSearchParams({ room: slug, from: toIso(from), to: toIso(to) });
  const p = fetch(`/api/calendar?${qs}`)
    .then((r) => (r.ok ? (r.json() as Promise<{ days: (Day & { date: string })[] }>) : Promise.reject(r.status)))
    .then(({ days }) => {
      months.set(k, new Map(days.map((d) => [Math.round(Date.parse(d.date) / DAY_MS), d])));
    })
    .catch(() => {
      months.set(k, 'error');
      if (slug === S.room) S.msg = 'Availability could not be loaded. Check your connection, then try again.';
    })
    .finally(() => {
      if (slug === S.room && root && S.step === 1) render(focusedSelector());
    });
  months.set(k, p);
}

function dayInfo(slug: string, n: number): Day | Status {
  if (n < TODAY) return 'past';
  const { y, m } = ymOf(n);
  const c = months.get(monthKey(slug, y, m));
  if (c === 'error') return 'closed';
  if (!(c instanceof Map)) return 'loading';
  return c.get(n) ?? 'closed';
}

const status = (slug: string, n: number): Status => {
  const d = dayInfo(slug, n);
  return typeof d === 'string' ? d : d.state;
};
const priceOf = (slug: string, n: number) => {
  const d = dayInfo(slug, n);
  return typeof d === 'string' ? null : d.price;
};

/* ------------------------------------------------------------------- state */

type Guest = { name: string; email: string; phone: string; country: string; arrival: string; notes: string };
type GuestKey = keyof Guest;

const S = {
  step: 1,
  room: '',
  guests: 2,
  start: null as number | null,
  end: null as number | null,
  month: { y: 2026, m: 0 },
  msg: PICK_IN,
  guest: { name: '', email: '', phone: '', country: '', arrival: '14:00', notes: '' } as Guest,
  errors: {} as Partial<Record<GuestKey, string>>,
  pay: 'villa',
  holdUntil: 0,
  ref: '',
};

let root: HTMLElement | null = null;
let home: HTMLElement | null = null;
let holdTimer = 0;

const rooms = () => boot().rooms;
const roomBySlug = (slug: string) => rooms().find((r) => r.slug === slug);
const current = () => roomBySlug(S.room) ?? rooms()[0]!;

function stayQuote(start: number, end: number) {
  const overrides = new Map<number, number>();
  for (let n = start; n < end; n++) overrides.set(n, priceOf(S.room, n) ?? current().baseRate);
  return quote({ baseRate: current().baseRate, checkIn: start, checkOut: end, rules: [], settings: boot().settings, overrides });
}

/* ------------------------------------------------------------------ render */

const stepsBar = () => {
  const names = ['Dates', 'Details', 'Confirm'];
  return `<ol class="bk__steps">${names
    .map((n, i) => {
      const k = i + 1;
      const cls = S.step > k ? 'is-done' : S.step === k ? 'is-current' : '';
      return `<li class="bk__step ${cls}" ${S.step === k ? 'aria-current="step"' : ''}><b>${S.step > k ? '✓' : k}</b><span>${n}</span></li>`;
    })
    .join('')}</ol>`;
};

function monthGrid(y: number, m: number) {
  const first = Date.UTC(y, m, 1) / DAY_MS;
  const lead = (toDate(first).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const hoverEnd = S.start !== null && S.end === null;
  let cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    .map((d) => `<span class="cal__dow" aria-hidden="true">${d}</span>`)
    .join('');
  cells += '<span></span>'.repeat(lead);
  for (let d = 1; d <= count; d++) {
    const n = first + d - 1;
    const st = status(S.room, n);
    const price = priceOf(S.room, n);
    const cls = ['cal__day', `is-${st === 'closed' ? 'past' : st}`];
    if (n === TODAY) cls.push('is-today');
    if (n === S.start) cls.push('is-start');
    if (n === S.end || (n === S.start && S.end === null)) cls.push('is-end');
    if (S.start !== null && S.end !== null && n > S.start && n < S.end) cls.push('is-range');
    const what = {
      free: `${money(price ?? 0)} per night`,
      booked: 'booked',
      reserved: 'on hold',
      past: 'in the past',
      closed: 'not open for booking',
      loading: 'loading',
    }[st];
    const off = st === 'past' || st === 'closed' || st === 'loading';
    cells += `<button type="button" class="${cls.join(' ')}" data-day="${n}" ${off ? 'disabled' : ''} ${
      st !== 'free' && !hoverEnd && !off ? 'aria-disabled="true"' : ''
    } aria-pressed="${n === S.start || n === S.end}" aria-label="${fmt(n, { weekday: 'long', day: 'numeric', month: 'long' })}, ${what}">${d}<small>${
      st === 'free' && price !== null ? money(price, { compact: true }) : ''
    }</small></button>`;
  }
  const name = toDate(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const busy = status(S.room, Math.max(first, TODAY)) === 'loading';
  return `<div class="cal__month"${busy ? ' aria-busy="true"' : ''}><p class="cal__month-name">${name}</p><div class="cal__grid">${cells}</div></div>`;
}

function summary() {
  const room = current();
  if (S.start === null || S.end === null) {
    return `<dl class="bk__summary"><dt>${esc(room.name)}, the ${esc(room.element)} room</dt><dd>from ${money(room.baseRate)} / night</dd></dl>`;
  }
  const q = stayQuote(S.start, S.end);
  const st = boot().settings;
  return `<dl class="bk__summary" aria-live="polite">
    <dt>${fmt(S.start)} → ${fmt(S.end)}</dt><dd>${plural(q.nights.length, 'night')}</dd>
    <dt>${esc(room.name)} · ${plural(S.guests, 'guest')}</dt><dd>${money(q.subtotal)}</dd>
    ${q.discount ? `<dt>Long-stay saving (${st.longStayNights}+ nights)</dt><dd>−${money(q.discount)}</dd>` : ''}
    <dt>Service charge (${st.serviceChargePercent}%)</dt><dd>${money(q.serviceCharge)}</dd>
    <dt class="bk__total">Total</dt><dd class="bk__total" data-bk-total>${money(q.total)}</dd>
  </dl>`;
}

function stepDates() {
  const room = current();
  const { y, m } = S.month;
  const next = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
  const now = ymOf(TODAY);
  const atStart = y === now.y && m === now.m;
  const atEnd = Date.UTC(next.y, next.m + 1, 1) / DAY_MS > TODAY + MAX_ADVANCE_DAYS;
  const cur = getCurrency();
  const failed = [S.month, next].some((mm) => months.get(monthKey(S.room, mm.y, mm.m)) === 'error');
  return `
    <div class="bk__row">
      <div class="field">
        <label for="bk-room">Room</label>
        <select id="bk-room" data-bk-room>${rooms()
          .map(
            (r) =>
              `<option value="${r.slug}" ${r.slug === S.room ? 'selected' : ''}>${esc(r.name)} · ${esc(r.element)} · sleeps ${r.maxGuests}</option>`,
          )
          .join('')}</select>
      </div>
      <div class="field" style="flex:0 0 auto">
        <span class="field__label" id="bk-guests-l">Guests</span>
        <div class="stepper" role="group" aria-labelledby="bk-guests-l">
          <button type="button" data-guests="-1" aria-label="Fewer guests" ${S.guests <= 1 ? 'disabled' : ''}>−</button>
          <output aria-live="polite">${S.guests}</output>
          <button type="button" data-guests="1" aria-label="More guests" ${S.guests >= room.maxGuests ? 'disabled' : ''}>+</button>
        </div>
      </div>
      <div class="field" style="flex:0 0 auto">
        <span class="field__label" id="bk-cur-l">Currency</span>
        <div class="seg" role="group" aria-labelledby="bk-cur-l">
          <button type="button" data-cur="USD" aria-pressed="${cur === 'USD'}">USD</button>
          <button type="button" data-cur="LKR" aria-pressed="${cur === 'LKR'}">LKR</button>
        </div>
      </div>
    </div>
    <div class="cal__head">
      <p class="bk__msg" data-bk-msg role="status">${esc(S.msg)}${
        failed ? ' <button type="button" class="link-caps" data-bk-retry>Try again</button>' : ''
      }</p>
      <div class="cal__nav">
        <button type="button" class="icon-btn" data-month="-1" aria-label="Previous month" ${atStart ? 'disabled' : ''}>${CHEV(true)}</button>
        <button type="button" class="icon-btn" data-month="1" aria-label="Next month" ${atEnd ? 'disabled' : ''}>${CHEV()}</button>
      </div>
    </div>
    <div class="cal" data-cal>${monthGrid(y, m)}${monthGrid(next.y, next.m)}</div>
    ${summary()}
    <div class="bk__actions">
      <button type="button" class="btn btn--line btn--sm" data-bk-clear ${S.start === null ? 'disabled' : ''}>Clear dates</button>
      <button type="button" class="btn btn--olive magnetic" data-bk-next ${S.end === null ? 'disabled' : ''}>Continue to details</button>
    </div>`;
}

const field = (id: string, label: string, input: string, key: GuestKey) => `
  <div class="field">
    <label for="${id}">${label}</label>
    ${input}
    <span class="field__error" id="${id}-err">${S.errors[key] ?? ''}</span>
  </div>`;

function stepDetails() {
  const g = S.guest;
  const inv = (k: GuestKey) => (S.errors[k] ? 'aria-invalid="true"' : '');
  return `
    <p class="bk__msg">Who's staying? We only use this to confirm your booking.</p>
    <div class="bk__row">
      ${field('bk-name', 'Full name', `<input id="bk-name" data-g="name" autocomplete="name" value="${esc(g.name)}" ${inv('name')} aria-describedby="bk-name-err">`, 'name')}
      ${field('bk-email', 'Email', `<input id="bk-email" type="email" data-g="email" autocomplete="email" value="${esc(g.email)}" ${inv('email')} aria-describedby="bk-email-err">`, 'email')}
    </div>
    <div class="bk__row">
      ${field('bk-phone', 'Phone or WhatsApp (optional)', `<input id="bk-phone" type="tel" data-g="phone" autocomplete="tel" value="${esc(g.phone)}">`, 'phone')}
      ${field('bk-country', 'Country', `<select id="bk-country" data-g="country" autocomplete="country-name">${COUNTRIES.map(
        (c) => `<option value="${c}" ${c === g.country ? 'selected' : ''}>${c || 'Select'}</option>`,
      ).join('')}</select>`, 'country')}
      ${field('bk-arrival', 'Arrival time', `<select id="bk-arrival" data-g="arrival">${TIMES.map(
        (t) => `<option ${t === g.arrival ? 'selected' : ''}>${t}</option>`,
      ).join('')}</select>`, 'arrival')}
    </div>
    <div class="bk__row">
      ${field('bk-notes', 'Anything we should know? (optional)', `<textarea id="bk-notes" data-g="notes" placeholder="Airport pickup, dietary needs, a surf lesson…">${esc(g.notes)}</textarea>`, 'notes')}
    </div>
    ${summary()}
    <div class="bk__actions">
      <button type="button" class="btn btn--line btn--sm" data-bk-back>Back to dates</button>
      <button type="button" class="btn btn--olive magnetic" data-bk-next>Review booking</button>
    </div>`;
}

function stepConfirm() {
  const room = current();
  const p = photo(room.photo);
  return `
    <div class="bk__review">
      ${p ? `<img src="${p.src}" alt="" width="${p.w}" height="${p.h}" style="object-fit:cover">` : '<span></span>'}
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">The ${esc(room.element)} room</p>
        <h3 class="h3">${esc(room.name)}</h3>
        <p style="margin:.4rem 0 0">${fmt(S.start!)} → ${fmt(S.end!)} · ${plural(S.guests, 'guest')}<br>${esc(S.guest.name)} · ${esc(S.guest.email)}</p>
      </div>
    </div>
    <p class="bk__msg" data-bk-hold role="timer"></p>
    <fieldset class="bk__pay" style="border:0;padding:0">
      <legend class="field__label" style="font-family:var(--sans);font-size:.66rem;letter-spacing:.2em;text-transform:uppercase;color:var(--taupe);margin-bottom:.4rem">How would you like to pay?</legend>
      <label><input type="radio" name="bk-pay" value="villa" ${S.pay === 'villa' ? 'checked' : ''}> Pay at the villa on arrival</label>
      <label><input type="radio" name="bk-pay" value="card" ${S.pay === 'card' ? 'checked' : ''}> Card now (demo, no charge is made)</label>
    </fieldset>
    ${summary()}
    <div class="bk__actions">
      <button type="button" class="btn btn--line btn--sm" data-bk-back>Back to details</button>
      <button type="button" class="btn btn--olive magnetic" data-bk-confirm>Confirm booking</button>
    </div>`;
}

function stepDone() {
  return `
    <div class="bk__done">
      ${MARK}
      <p class="eyebrow">Booking confirmed</p>
      <h3 class="h2" style="margin-bottom:.8rem">See you in Weligama, ${esc(S.guest.name.trim().split(' ')[0])}.</h3>
      <p>${esc(current().name)} · ${fmt(S.start!)} → ${fmt(S.end!)}</p>
      <p class="bk__ref">Reference ${S.ref}</p>
      <p class="proto-note" style="margin-bottom:1.4rem">Preview: nothing is booked, emailed or charged yet. Online payment with PayHere arrives in the next build step; the live site then sends a confirmation email and updates Booking.com straight away.</p>
      <button type="button" class="btn btn--olive" data-bk-restart>Book another room</button>
    </div>`;
}

function focusedSelector() {
  const a = document.activeElement as HTMLElement | null;
  if (!root || !a || !root.contains(a)) return undefined;
  for (const k of ['day', 'month', 'cur', 'guests'] as const) {
    if (a.dataset[k]) return `[data-${k}="${a.dataset[k]}"]`;
  }
  if (a.id) return `#${a.id}`;
  for (const attr of ['data-bk-next', 'data-bk-clear', 'data-bk-retry']) if (a.hasAttribute(attr)) return `[${attr}]`;
  return undefined;
}

function render(focusSel?: string) {
  if (!root) return;
  if (S.step === 1) {
    // The two months on screen, plus the next one so paging forward is instant.
    for (let k = 0; k < 3; k++) {
      const d = new Date(Date.UTC(S.month.y, S.month.m + k, 1));
      ensureMonth(S.room, d.getUTCFullYear(), d.getUTCMonth());
    }
  }
  const body = S.step === 1 ? stepDates() : S.step === 2 ? stepDetails() : S.step === 3 ? stepConfirm() : stepDone();
  root.innerHTML = `<div class="bk">${S.step < 4 ? stepsBar() : ''}<div class="bk__body">${body}</div></div>`;
  if (focusSel) $(focusSel, root)?.focus({ preventScroll: true });
  if (S.step === 3) tickHold();
  root.dispatchEvent(new CustomEvent('vy:rendered', { bubbles: true }));
}

/* ------------------------------------------------------------------- logic */

function pick(n: number) {
  const st = status(S.room, n);
  if (S.start !== null && S.end === null && n > S.start) {
    for (let d = S.start; d < n; d++) {
      const s = status(S.room, d);
      if (s === 'loading') {
        S.msg = 'Still loading availability for those dates. Try again in a moment.';
        return render(`[data-day="${n}"]`);
      }
      if (s !== 'free') {
        S.msg = `That stay includes a night that's already taken (${fmt(d)}). Choose an earlier check-out or other dates.`;
        return render(`[data-day="${n}"]`);
      }
    }
    if (n - S.start > MAX_NIGHTS) {
      S.msg = `Stays are limited to ${MAX_NIGHTS} nights online. Message us for longer stays.`;
      return render(`[data-day="${n}"]`);
    }
    const first = dayInfo(S.room, S.start);
    const minStay = typeof first === 'string' ? null : first.minStay;
    if (minStay && n - S.start < minStay) {
      S.msg = `Stays from ${fmt(S.start)} are at least ${minStay} nights. Choose a later check-out.`;
      return render(`[data-day="${n}"]`);
    }
    S.end = n;
    S.msg = `${plural(n - S.start, 'night')} selected. Check the total, then continue.`;
    return render('[data-bk-next]');
  }
  if (st === 'booked' || st === 'reserved') {
    S.msg =
      st === 'booked'
        ? `${fmt(n)} is booked. Choose another check-in date.`
        : `${fmt(n)} is on hold for another guest who's paying now. Choose another date.`;
    return render(`[data-day="${n}"]`);
  }
  S.start = n;
  S.end = null;
  S.msg = `Check-in ${fmt(n)}. Now choose your check-out date.`;
  render(`[data-day="${n}"]`);
}

function previewRange(n: number | null) {
  if (!root || S.start === null || S.end !== null) return;
  const start = S.start;
  $$('[data-day]', root).forEach((b) => {
    const d = Number(b.dataset.day);
    b.classList.toggle('is-range', n !== null && d > start && d < n);
  });
}

function validate() {
  const g = S.guest;
  const e: typeof S.errors = {};
  if (g.name.trim().length < 2) e.name = 'Enter the name the booking is for.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.email.trim())) e.email = 'Enter an email address like name@example.com.';
  S.errors = e;
  return Object.keys(e).length === 0;
}

function tickHold() {
  clearInterval(holdTimer);
  const el = root && $('[data-bk-hold]', root);
  if (!el) return;
  const upd = () => {
    const left = Math.max(0, S.holdUntil - Date.now());
    if (left === 0) {
      clearInterval(holdTimer);
      S.step = 1;
      S.end = null;
      S.msg = 'Your hold expired, so the dates were released. Choose them again to continue.';
      return render();
    }
    const mm = Math.floor(left / 60000);
    const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    el.textContent = `We're holding these dates for you for ${mm}:${ss}.`;
  };
  upd();
  holdTimer = window.setInterval(upd, 1000);
}

function goto(step: number, focus?: string) {
  if (step !== 3) clearInterval(holdTimer);
  S.step = step;
  render(focus);
  root?.closest('.drawer__sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function mockRef() {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const r = crypto.getRandomValues(new Uint8Array(5));
  return `VY-${[...r].map((b) => chars[b % chars.length]).join('')}`;
}

function onClick(e: MouseEvent) {
  const t = (e.target as Element).closest('button');
  if (!t || t.disabled) return;
  const ds = t.dataset;
  if (ds.day) return pick(Number(ds.day));
  if (ds.month) {
    const { y, m } = S.month;
    const d = new Date(Date.UTC(y, m + Number(ds.month), 1));
    S.month = { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    return render(`[data-month="${ds.month}"]`);
  }
  if (ds.guests) {
    S.guests = Math.min(current().maxGuests, Math.max(1, S.guests + Number(ds.guests)));
    return render(`[data-guests="${ds.guests}"]`);
  }
  if (ds.cur) return setCurrency(ds.cur as Currency);
  if (t.hasAttribute('data-bk-retry')) {
    for (const [k, v] of months) if (v === 'error') months.delete(k);
    S.msg = S.start === null ? PICK_IN : `Check-in ${fmt(S.start)}. Now choose your check-out date.`;
    return render();
  }
  if (t.hasAttribute('data-bk-clear')) {
    S.start = S.end = null;
    S.msg = PICK_IN;
    return render();
  }
  if (t.hasAttribute('data-bk-back')) return goto(S.step - 1);
  if (t.hasAttribute('data-bk-next')) {
    if (S.step === 1) return goto(2, '#bk-name');
    if (S.step === 2) {
      if (!validate()) return render(S.errors.name ? '#bk-name' : '#bk-email');
      S.holdUntil = Date.now() + boot().settings.holdMinutes * 60000;
      return goto(3, '[data-bk-confirm]');
    }
  }
  if (t.hasAttribute('data-bk-confirm')) {
    t.disabled = true;
    t.textContent = 'Confirming…';
    setTimeout(() => {
      // Mock until step 4: mark the nights booked in this tab's calendar.
      for (let d = S.start!; d < S.end!; d++) {
        const c = months.get(monthKey(S.room, ymOf(d).y, ymOf(d).m));
        const day = c instanceof Map ? c.get(d) : undefined;
        if (day) day.state = 'booked';
      }
      S.ref = mockRef();
      toast(`Booking confirmed. Your reference is ${S.ref}.`);
      goto(4);
    }, 900);
    return;
  }
  if (t.hasAttribute('data-bk-restart')) {
    Object.assign(S, { start: null, end: null, errors: {}, msg: PICK_IN });
    goto(1);
  }
}

function onInput(e: Event) {
  const t = e.target as HTMLInputElement;
  const key = t.dataset.g as GuestKey | undefined;
  if (key) {
    S.guest[key] = t.value;
    if (S.errors[key]) {
      delete S.errors[key];
      t.removeAttribute('aria-invalid');
      const err = root && $(`#${t.id}-err`, root);
      if (err) err.textContent = '';
    }
  }
  if (t.name === 'bk-pay') S.pay = t.value;
}

function selectRoom(slug: string) {
  const r = roomBySlug(slug);
  if (!r) return;
  S.room = slug;
  S.guests = Math.min(S.guests, r.maxGuests);
  if (S.start !== null) {
    const end = S.end ?? S.start + 1;
    let ok = true;
    for (let d = S.start; d < end; d++) {
      const s = status(slug, d);
      if (s !== 'free' && s !== 'loading') ok = false;
    }
    if (!ok) {
      S.start = S.end = null;
      S.msg = `Those dates aren't free in ${r.name}. Choose new dates.`;
    } else if (S.end !== null && status(slug, S.start) === 'loading') {
      // Prices and availability for the new room arrive shortly; ask again then.
      S.end = null;
      S.msg = `Check-in ${fmt(S.start)}. Now choose your check-out date.`;
    }
  }
}

/** Pre-select a room, resetting a finished or half-finished booking. */
function openOn(slug: string | undefined) {
  if (!slug || !roomBySlug(slug)) return;
  selectRoom(slug);
  if (S.step > 1 && S.step < 4) S.step = 1;
  if (S.step === 4) Object.assign(S, { step: 1, start: null, end: null, msg: PICK_IN });
}

/* ------------------------------------------------------------------ drawer */

let opener: HTMLElement | null = null;

function drawerParts() {
  const drawer = $('[data-drawer]');
  const sheet = drawer && $('.drawer__sheet', drawer);
  const slot = drawer && $('[data-drawer-body]', drawer);
  return drawer && sheet && slot ? { drawer, sheet, slot } : null;
}

export function openBooking(btn?: HTMLElement | null) {
  const d = drawerParts();
  if (!root || !d) return;
  openOn(btn?.dataset.room);
  render();
  btn?.closest('dialog')?.close();
  opener = btn ?? null;
  d.slot.append(root);
  if (d.drawer.hidden) {
    d.drawer.hidden = false;
    lockScroll(true);
  }
  d.sheet.focus();
}

export function closeBooking() {
  const d = drawerParts();
  if (!root || !d || d.drawer.hidden) return;
  d.drawer.hidden = true;
  if (home) home.append(root);
  else root.remove();
  lockScroll(false);
  if (opener?.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}

function initDrawer() {
  // Capture phase, so a <Link data-open-booking> doesn't navigate first.
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element;
      const b = target.closest<HTMLElement>('[data-open-booking]');
      if (b && !root?.contains(b)) {
        e.preventDefault();
        openBooking(b);
      }
      if (target.closest('[data-drawer-close]')) closeBooking();
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    const d = drawerParts();
    if (!d || d.drawer.hidden) return;
    if (e.key === 'Escape') return closeBooking();
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]), input, select, textarea, [href]', d.sheet).filter((x) => x.offsetParent);
    const first = f[0];
    const last = f[f.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

/* --------------------------------------------------------------------- api */

export function initBooking() {
  if (root) return;
  const list = rooms();
  if (!list.length) return;
  TODAY = today();
  const t = ymOf(TODAY);
  S.month = { y: t.y, m: t.m };
  S.room = list[0]!.slug;
  S.guests = Math.min(2, list[0]!.maxGuests);

  root = document.createElement('div');
  root.className = 'bk-root';
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.matches('[data-bk-room]')) {
      selectRoom(el.value);
      render('[data-bk-room]');
    } else onInput(e);
  });
  root.addEventListener('pointerover', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-day]');
    previewRange(b ? Number(b.dataset.day) : null);
  });
  root.addEventListener('pointerleave', () => previewRange(null));
  onCurrency(() => {
    if (S.step !== 2) render(focusedSelector());
  });
  render();
  initDrawer();
}

/** Shows the widget inside a page's booking section; returns the unmount. */
export function mountBooking(el: HTMLElement, roomSlug?: string) {
  initBooking();
  if (!root) return () => {};
  home = el;
  if (roomSlug) {
    openOn(roomSlug);
    render();
  }
  const d = drawerParts();
  if (!d || d.drawer.hidden) el.append(root);
  return () => {
    if (home !== el) return;
    home = null;
    if (root?.parentElement === el) root.remove();
  };
}
