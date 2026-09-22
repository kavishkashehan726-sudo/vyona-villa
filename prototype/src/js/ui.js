// Nav, mobile menu, toast, prototype badge, lazy map, footer year, mobile book bar.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let toastTimer;
export function toast(msg) {
  const el = $('[data-toast]');
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 3600);
}

let locks = 0;
export function lockScroll(on) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.body.classList.toggle('is-locked', locks > 0);
}

function initNav() {
  const nav = $('[data-nav]');
  const toggle = $('[data-menu-toggle]');
  const menu = $('#mobile-menu');
  let lastY = window.scrollY;
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 30);
    const down = y > lastY && y > window.innerHeight * 0.9;
    nav.classList.toggle('is-hidden', down && menu.hidden);
    lastY = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) requestAnimationFrame(onScroll);
      ticking = true;
    },
    { passive: true }
  );
  onScroll();

  const setMenu = (open) => {
    if (open === !menu.hidden) return;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    lockScroll(open);
    if (open) menu.querySelector('a')?.focus();
  };
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (m) => m.matches && setMenu(false));
}

function initBadge() {
  const badge = $('[data-proto-badge]');
  try {
    if (sessionStorage.getItem('vy-badge') === 'off') badge.hidden = true;
  } catch {
    /* storage unavailable */
  }
  $('[data-proto-close]').addEventListener('click', () => {
    badge.hidden = true;
    try {
      sessionStorage.setItem('vy-badge', 'off');
    } catch {
      /* storage unavailable */
    }
  });
}

// Google Maps is the only external request, and it only loads when the
// section is near the viewport and the browser is online.
function initMap() {
  const box = $('[data-map]');
  if (!box || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting || !navigator.onLine) return;
      io.disconnect();
      const f = document.createElement('iframe');
      f.title = 'Map of Weligama, Sri Lanka';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = 'https://www.google.com/maps?q=Weligama,+Sri+Lanka&z=14&output=embed';
      box.append(f);
    },
    { rootMargin: '400px 0px' }
  );
  io.observe(box);
}

function initBookBar() {
  const bar = $('[data-book-bar]');
  const hero = $('.hero');
  const booking = $('#booking');
  if (!('IntersectionObserver' in window)) return;
  let pastHero = false;
  let atBooking = false;
  const sync = () => bar.classList.toggle('is-on', pastHero && !atBooking);
  new IntersectionObserver(([e]) => {
    pastHero = !e.isIntersecting;
    sync();
  }).observe(hero);
  new IntersectionObserver(([e]) => {
    atBooking = e.isIntersecting;
    sync();
  }).observe(booking);
}

export function initUI() {
  initNav();
  initBadge();
  initMap();
  initBookBar();
  $$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
}
