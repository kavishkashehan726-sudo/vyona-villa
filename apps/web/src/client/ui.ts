// Small DOM helpers shared by the client modules: toast, scroll lock and the lazy map.

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

/**
 * Brings a section into view under the fixed nav. When the section fits on screen, a strip of
 * what's above it stays visible (up to 80px), so it reads as part of the page rather than a jump.
 */
export function scrollToSection(el: HTMLElement, smooth: boolean) {
  const nav = $('.nav')?.offsetHeight ?? 0;
  const box = el.getBoundingClientRect();
  const content = box.height - parseFloat(getComputedStyle(el).paddingBottom);
  const gap = Math.min(80, Math.max(16, window.innerHeight - nav - content));
  const top = Math.max(0, box.top + window.scrollY - nav - gap);
  window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
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
      const q = box.dataset.mapQ || 'Weligama, Sri Lanka';
      f.title = `Map: ${q}`;
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      // The server works out the URL from the owner's Google Maps link or map location.
      f.src = box.dataset.mapSrc || `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
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
