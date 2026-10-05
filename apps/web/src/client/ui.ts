// Small DOM helpers shared by the client modules: toast, scroll lock,
// prototype badge and the lazy map.

export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];

let toastTimer = 0;
export function toast(msg: string) {
  const el = $('[data-toast]');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-on'), 3600);
}

let locks = 0;
export function lockScroll(on: boolean) {
  locks = Math.max(0, locks + (on ? 1 : -1));
  document.body.classList.toggle('is-locked', locks > 0);
}

export function initBadge() {
  const badge = $('[data-proto-badge]');
  if (!badge) return;
  try {
    if (sessionStorage.getItem('vy-badge') === 'off') badge.hidden = true;
  } catch {
    /* storage unavailable */
  }
  $('[data-proto-close]', badge)?.addEventListener('click', () => {
    badge.hidden = true;
    try {
      sessionStorage.setItem('vy-badge', 'off');
    } catch {
      /* storage unavailable */
    }
  });
}

// Google Maps is the only third-party request, and it only loads when the
// section is near the viewport and the browser is online.
export function initMap(box: HTMLElement) {
  if (!('IntersectionObserver' in window)) return () => {};
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e?.isIntersecting || !navigator.onLine) return;
      io.disconnect();
      const f = document.createElement('iframe');
      f.title = 'Map of Weligama, Sri Lanka';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = 'https://www.google.com/maps?q=Weligama,+Sri+Lanka&z=14&output=embed';
      box.append(f);
    },
    { rootMargin: '400px 0px' },
  );
  io.observe(box);
  return () => io.disconnect();
}

/** Escapes text for the booking widget's HTML strings. */
export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
