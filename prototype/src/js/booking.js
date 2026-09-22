// Mock booking flow: Dates -> Details -> Confirm.
// Availability is generated deterministically per room so the client sees a
// realistic calendar. It mirrors the SRS states: available / reserved (on hold,
// pending payment) / booked. A confirmed demo booking marks its nights booked
// for the rest of the session. Nothing leaves the browser.

import { ROOMS, roomById } from './rooms.js';
import { photo } from './images.js';
import { money, getCurrency, setCurrency, onCurrency } from './store.js';
import { $, $$, toast, lockScroll } from './ui.js';

const DAY = 86400000;
const HOLD_MINUTES = 15;
const SERVICE = 0.1;
const LONG_STAY_NIGHTS = 7;
const LONG_STAY_OFF = 0.1;

const now = new Date();
const TODAY = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY);
const toDate = (n) => new Date(n * DAY);
const fmt = (n, o = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  toDate(n).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const confirmed = new Map();

function status(roomId, n) {
  if (n < TODAY) return 'past';
  if (confirmed.get(roomId)?.has(n)) return 'booked';
  const offset = roomId.charCodeAt(0) % 3;
  const block = hash(`${roomId}:${Math.floor((n + offset) / 3)}`);
  const single = hash(`${roomId}#${n}`);
  if (block < 0.16 || single < 0.05) return 'booked';
  if (single > 0.95) return 'reserved';
  return 'free';
}

function nightly(room, n) {
  const d = toDate(n);
  let p = room.price;
  const m = d.getUTCMonth();
  if (m === 11 || m <= 2) p *= 1.2; // Dec-Mar: peak season on the south coast
  const dow = d.getUTCDay();
  if (dow === 5 || dow === 6) p *= 1.12; // Fri/Sat nights
  return Math.round(p);
}

function quote(S) {
  const room = roomById(S.room);
  const nights = [];
  for (let n = S.start; n < S.end; n++) nights.push(nightly(room, n));
  const sub = nights.reduce((a, b) => a + b, 0);
  const off = nights.length >= LONG_STAY_NIGHTS ? Math.round(sub * LONG_STAY_OFF) : 0;
  const service = Math.round((sub - off) * SERVICE);
  return { nights: nights.length, sub, off, service, total: sub - off + service };
}

const S = {
  step: 1,
  room: ROOMS[0].id,
  guests: 2,
  start: null,
  end: null,
  month: { y: now.getFullYear(), m: now.getMonth() },
  msg: 'Choose your check-in date.',
  guest: { name: '', email: '', phone: '', country: '', arrival: '14:00', notes: '' },
  errors: {},
  pay: 'villa',
  holdUntil: 0,
  ref: '',
};

let root;
let holdTimer;

/* ---------------------------------------------------------------- render */

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

function monthGrid(y, m) {
  const first = Date.UTC(y, m, 1) / DAY;
  const lead = (toDate(first).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const room = roomById(S.room);
  const hoverEnd = S.start !== null && S.end === null;
  let cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    .map((d) => `<span class="cal__dow" aria-hidden="true">${d}</span>`)
    .join('');
  cells += '<span></span>'.repeat(lead);
  for (let d = 1; d <= count; d++) {
    const n = first + d - 1;
    const st = status(S.room, n);
    const cls = ['cal__day', `is-${st}`];
    if (n === TODAY) cls.push('is-today');
    if (n === S.start) cls.push('is-start');
    if (n === S.end || (n === S.start && S.end === null)) cls.push('is-end');
    if (S.end !== null && n > S.start && n < S.end) cls.push('is-range');
    const price = nightly(room, n);
    const label = `${fmt(n, { weekday: 'long', day: 'numeric', month: 'long' })}, ${
      st === 'free' ? `${money(price)} per night` : st === 'booked' ? 'booked' : st === 'reserved' ? 'on hold' : 'in the past'
    }`;
    cells += `<button type="button" class="${cls.join(' ')}" data-day="${n}" ${st === 'past' ? 'disabled' : ''} ${
      st !== 'free' && !hoverEnd && st !== 'past' ? 'aria-disabled="true"' : ''
    } aria-pressed="${n === S.start || n === S.end}" aria-label="${label}">${d}<small>${
      st === 'free' ? money(price, { compact: true }) : ''
    }</small></button>`;
  }
  const name = toDate(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `<div class="cal__month"><p class="cal__month-name">${name}</p><div class="cal__grid">${cells}</div></div>`;
}

function summary() {
  if (S.start === null || S.end === null) {
    const room = roomById(S.room);
    return `<dl class="bk__summary"><dt>${room.name}, the ${room.element} room</dt><dd>from ${money(room.price)} / night</dd></dl>`;
  }
  const q = quote(S);
  return `<dl class="bk__summary" aria-live="polite">
    <dt>${fmt(S.start)} → ${fmt(S.end)}</dt><dd>${q.nights} night${q.nights > 1 ? 's' : ''}</dd>
    <dt>${roomById(S.room).name} · ${S.guests} guest${S.guests > 1 ? 's' : ''}</dt><dd>${money(q.sub)}</dd>
    ${q.off ? `<dt>Long-stay saving (${LONG_STAY_NIGHTS}+ nights)</dt><dd>−${money(q.off)}</dd>` : ''}
    <dt>Service charge (10%)</dt><dd>${money(q.service)}</dd>
    <dt class="bk__total">Total</dt><dd class="bk__total" data-bk-total>${money(q.total)}</dd>
  </dl>`;
}

function stepDates() {
  const room = roomById(S.room);
  const { y, m } = S.month;
  const next = m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 };
  const atStart = y === now.getFullYear() && m === now.getMonth();
  const cur = getCurrency();
  return `
    <div class="bk__row">
      <div class="field">
        <label for="bk-room">Room</label>
        <select id="bk-room" data-bk-room>${ROOMS.map(
          (r) => `<option value="${r.id}" ${r.id === S.room ? 'selected' : ''}>${r.name} · ${r.element} · sleeps ${r.guests}</option>`
        ).join('')}</select>
      </div>
      <div class="field" style="flex:0 0 auto">
        <span class="field__label" id="bk-guests-l">Guests</span>
        <div class="stepper" role="group" aria-labelledby="bk-guests-l">
          <button type="button" data-guests="-1" aria-label="Fewer guests" ${S.guests <= 1 ? 'disabled' : ''}>−</button>
          <output aria-live="polite">${S.guests}</output>
          <button type="button" data-guests="1" aria-label="More guests" ${S.guests >= room.guests ? 'disabled' : ''}>+</button>
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
      <p class="bk__msg" data-bk-msg role="status">${S.msg}</p>
      <div class="cal__nav">
        <button type="button" class="icon-btn" data-month="-1" aria-label="Previous month" ${atStart ? 'disabled' : ''}><svg class="i" style="transform:scaleX(-1)"><use href="#i-chev"/></svg></button>
        <button type="button" class="icon-btn" data-month="1" aria-label="Next month"><svg class="i"><use href="#i-chev"/></svg></button>
      </div>
    </div>
    <div class="cal" data-cal>${monthGrid(y, m)}${monthGrid(next.y, next.m)}</div>
    ${summary()}
    <div class="bk__actions">
      <button type="button" class="btn btn--line btn--sm" data-bk-clear ${S.start === null ? 'disabled' : ''}>Clear dates</button>
      <button type="button" class="btn btn--olive magnetic" data-bk-next ${S.end === null ? 'disabled' : ''}>Continue to details</button>
    </div>`;
}

const field = (id, label, input, key) => `
  <div class="field">
    <label for="${id}">${label}</label>
    ${input}
    <span class="field__error" id="${id}-err">${S.errors[key] || ''}</span>
  </div>`;

function stepDetails() {
  const g = S.guest;
  const inv = (k) => (S.errors[k] ? 'aria-invalid="true"' : '');
  const countries = ['', 'Sri Lanka', 'United Kingdom', 'Germany', 'Australia', 'India', 'France', 'Netherlands', 'United States', 'Russia', 'Other'];
  const times = ['12:00', '14:00', '16:00', '18:00', '20:00', 'After 22:00'];
  return `
    <p class="bk__msg">Who's staying? We only use this to confirm your booking.</p>
    <div class="bk__row">
      ${field('bk-name', 'Full name', `<input id="bk-name" data-g="name" autocomplete="name" value="${esc(g.name)}" ${inv('name')} aria-describedby="bk-name-err">`, 'name')}
      ${field('bk-email', 'Email', `<input id="bk-email" type="email" data-g="email" autocomplete="email" value="${esc(g.email)}" ${inv('email')} aria-describedby="bk-email-err">`, 'email')}
    </div>
    <div class="bk__row">
      ${field('bk-phone', 'Phone or WhatsApp (optional)', `<input id="bk-phone" type="tel" data-g="phone" autocomplete="tel" value="${esc(g.phone)}">`, 'phone')}
      ${field('bk-country', 'Country', `<select id="bk-country" data-g="country" autocomplete="country-name">${countries
        .map((c) => `<option value="${c}" ${c === g.country ? 'selected' : ''}>${c || 'Select'}</option>`)
        .join('')}</select>`, 'country')}
      ${field('bk-arrival', 'Arrival time', `<select id="bk-arrival" data-g="arrival">${times
        .map((t) => `<option ${t === g.arrival ? 'selected' : ''}>${t}</option>`)
        .join('')}</select>`, 'arrival')}
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
  const room = roomById(S.room);
  const p = photo(room.photos[0]);
  return `
    <div class="bk__review">
      ${p ? `<img src="${p.src}" alt="" width="${p.w}" height="${p.h}" style="object-fit:cover">` : '<span></span>'}
      <div>
        <p class="eyebrow" style="margin-bottom:.3rem">The ${room.element} room</p>
        <h3 class="h3">${room.name}</h3>
        <p style="margin:.4rem 0 0">${fmt(S.start)} → ${fmt(S.end)} · ${S.guests} guest${S.guests > 1 ? 's' : ''}<br>${esc(S.guest.name)} · ${esc(S.guest.email)}</p>
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
      <svg aria-hidden="true"><use href="#vy-mark"/></svg>
      <p class="eyebrow">Booking confirmed</p>
      <h3 class="h2" style="margin-bottom:.8rem">See you in Weligama, ${esc(S.guest.name.split(' ')[0])}.</h3>
      <p>${roomById(S.room).name} · ${fmt(S.start)} → ${fmt(S.end)}</p>
      <p class="bk__ref">Reference ${S.ref}</p>
      <p class="proto-note" style="margin-bottom:1.4rem">Prototype: no email is sent and nothing is charged. In the live site this step sends a confirmation email and updates Booking.com straight away.</p>
      <button type="button" class="btn btn--olive" data-bk-restart>Book another room</button>
    </div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function render(focusSel) {
  const body = S.step === 1 ? stepDates() : S.step === 2 ? stepDetails() : S.step === 3 ? stepConfirm() : stepDone();
  root.innerHTML = `<div class="bk">${S.step < 4 ? stepsBar() : ''}<div class="bk__body">${body}</div></div>`;
  if (focusSel) root.querySelector(focusSel)?.focus({ preventScroll: true });
  if (S.step === 3) tickHold();
  root.dispatchEvent(new CustomEvent('vy:rendered', { bubbles: true }));
}

/* ----------------------------------------------------------------- logic */

function pick(n) {
  const st = status(S.room, n);
  if (S.start !== null && S.end === null && n > S.start) {
    for (let d = S.start; d < n; d++) {
      if (status(S.room, d) !== 'free') {
        S.msg = `That stay includes a night that's already taken (${fmt(d)}). Choose an earlier check-out or other dates.`;
        return render(`[data-day="${n}"]`);
      }
    }
    if (n - S.start > 30) {
      S.msg = 'Stays are limited to 30 nights online. Message us for longer stays.';
      return render(`[data-day="${n}"]`);
    }
    S.end = n;
    const q = quote(S);
    S.msg = `${q.nights} night${q.nights > 1 ? 's' : ''} selected. Check the total, then continue.`;
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

function previewRange(n) {
  if (S.start === null || S.end !== null) return;
  $$('[data-day]', root).forEach((b) => {
    const d = Number(b.dataset.day);
    b.classList.toggle('is-range', n !== null && d > S.start && d < n);
  });
}

function validate() {
  const g = S.guest;
  const e = {};
  if (g.name.trim().length < 2) e.name = 'Enter the name the booking is for.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g.email.trim())) e.email = 'Enter an email address like name@example.com.';
  S.errors = e;
  return Object.keys(e).length === 0;
}

function tickHold() {
  clearInterval(holdTimer);
  const el = $('[data-bk-hold]', root);
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
  holdTimer = setInterval(upd, 1000);
}

function goto(step, focus) {
  if (step !== 3) clearInterval(holdTimer);
  S.step = step;
  render(focus);
  root.closest('.drawer__sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function onClick(e) {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  if (t.dataset.day) return pick(Number(t.dataset.day));
  if (t.dataset.month) {
    const { y, m } = S.month;
    const d = new Date(y, m + Number(t.dataset.month), 1);
    S.month = { y: d.getFullYear(), m: d.getMonth() };
    return render(`[data-month="${t.dataset.month}"]`);
  }
  if (t.dataset.guests) {
    S.guests = Math.min(roomById(S.room).guests, Math.max(1, S.guests + Number(t.dataset.guests)));
    return render(`[data-guests="${t.dataset.guests}"]`);
  }
  if (t.dataset.cur) return setCurrency(t.dataset.cur);
  if (t.hasAttribute('data-bk-clear')) {
    S.start = S.end = null;
    S.msg = 'Choose your check-in date.';
    return render();
  }
  if (t.hasAttribute('data-bk-back')) return goto(S.step - 1);
  if (t.hasAttribute('data-bk-next')) {
    if (S.step === 1) return goto(2, '#bk-name');
    if (S.step === 2) {
      if (!validate()) return render(S.errors.name ? '#bk-name' : '#bk-email');
      S.holdUntil = Date.now() + HOLD_MINUTES * 60000;
      return goto(3, '[data-bk-confirm]');
    }
  }
  if (t.hasAttribute('data-bk-confirm')) {
    t.disabled = true;
    t.textContent = 'Confirming…';
    setTimeout(() => {
      const set = confirmed.get(S.room) || new Set();
      for (let d = S.start; d < S.end; d++) set.add(d);
      confirmed.set(S.room, set);
      S.ref = `VY-${String(Math.floor(hash(`${Date.now()}`) * 900000 + 100000))}`;
      toast(`Booking confirmed. Your reference is ${S.ref}.`);
      goto(4);
    }, 900);
    return;
  }
  if (t.hasAttribute('data-bk-restart')) {
    Object.assign(S, { start: null, end: null, errors: {}, msg: 'Choose your check-in date.' });
    goto(1);
  }
}

function onInput(e) {
  const t = e.target;
  if (t.dataset.g) {
    S.guest[t.dataset.g] = t.value;
    if (S.errors[t.dataset.g]) {
      delete S.errors[t.dataset.g];
      t.removeAttribute('aria-invalid');
      $(`#${t.id}-err`, root).textContent = '';
    }
  }
  if (t.name === 'bk-pay') S.pay = t.value;
}

function selectRoom(id) {
  const r = roomById(id);
  if (!r) return;
  S.room = id;
  S.guests = Math.min(S.guests, r.guests);
  if (S.start !== null) {
    const end = S.end ?? S.start + 1;
    let ok = true;
    for (let d = S.start; d < end; d++) if (status(id, d) !== 'free') ok = false;
    if (!ok) {
      S.start = S.end = null;
      S.msg = `Those dates aren't free in ${r.name}. Choose new dates.`;
    }
  }
}

/* ---------------------------------------------------------------- drawer */

function initDrawer() {
  const drawer = $('[data-drawer]');
  const sheet = $('.drawer__sheet', drawer);
  const slot = $('[data-drawer-body]');
  const home = $('[data-booking-panel]');
  let opener = null;

  const open = (btn) => {
    const roomId = btn?.dataset.room;
    if (roomId) {
      selectRoom(roomId);
      if (S.step > 1 && S.step < 4) S.step = 1;
      if (S.step === 4) Object.assign(S, { step: 1, start: null, end: null, msg: 'Choose your check-in date.' });
      render();
    }
    btn?.closest('dialog')?.close();
    opener = btn;
    slot.append(root);
    drawer.hidden = false;
    lockScroll(true);
    sheet.focus();
  };
  const close = () => {
    if (drawer.hidden) return;
    drawer.hidden = true;
    home.append(root);
    lockScroll(false);
    opener?.focus?.({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open-booking]');
    if (b && !root.contains(b)) {
      e.preventDefault();
      open(b);
    }
    if (e.target.closest('[data-drawer-close]')) close();
  });
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return close();
    if (e.key !== 'Tab') return;
    const f = $$('button:not([disabled]), input, select, textarea, [href]', sheet).filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f[f.length - 1].focus();
    } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
      e.preventDefault();
      f[0].focus();
    }
  });
}

export function initBooking() {
  root = document.createElement('div');
  root.className = 'bk-root';
  $('[data-booking-panel]').append(root);
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-bk-room]')) {
      selectRoom(e.target.value);
      render('[data-bk-room]');
    } else onInput(e);
  });
  root.addEventListener('pointerover', (e) => {
    const b = e.target.closest('[data-day]');
    previewRange(b ? Number(b.dataset.day) : null);
  });
  root.addEventListener('pointerleave', () => previewRange(null));
  onCurrency(() => {
    const active = document.activeElement?.dataset?.cur;
    if (S.step !== 2) render(active ? `[data-cur="${active}"]` : undefined);
  });
  render();
  initDrawer();
}
