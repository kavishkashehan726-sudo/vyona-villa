// Blur-up image loading. The server renders every photo on its 24px blurred
// placeholder with data-img (or data-img-bg) set to its key; the full WebP is
// swapped in once the element approaches the viewport. New elements (client
// navigation, dialogs) are picked up by a MutationObserver.

import { boot } from './boot';

export const photo = (key: string) => boot().photos[key];

let io: IntersectionObserver | null = null;

function observer() {
  if (io || !('IntersectionObserver' in window)) return io;
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io?.unobserve(e.target);
        load(e.target as HTMLElement);
      }
    },
    { rootMargin: '600px 0px' },
  );
  return io;
}

function load(el: HTMLElement) {
  const p = photo(el.dataset.img ?? el.dataset.imgBg ?? '');
  if (!p || el.classList.contains('is-loaded')) return;
  const probe = new Image();
  probe.src = p.src;
  const done = () => {
    if (el instanceof HTMLImageElement) el.src = p.src;
    else el.style.backgroundImage = `url("${p.src}")`;
    el.classList.add('is-loaded');
  };
  probe.decode().then(done, done);
}

/** Point an element at a photo key and lazy-load it. */
export function setPhoto(el: HTMLElement, key: string, { eager = false } = {}) {
  const p = photo(key);
  if (!p) return;
  const changed = (el.dataset.img ?? el.dataset.imgBg) !== key;
  if (changed) el.classList.remove('is-loaded');
  if (el instanceof HTMLImageElement) {
    el.dataset.img = key;
    el.width = p.w;
    el.height = p.h;
    el.decoding = 'async';
  } else {
    el.dataset.imgBg = key;
  }
  el.classList.add('blur-img');
  const o = observer();
  if (eager || !o) load(el);
  else o.observe(el);
}

/** Lazy-load every [data-img] / [data-img-bg] under root that isn't loaded yet. */
export function hydrate(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-img]:not(.is-loaded)').forEach((el) => setPhoto(el, el.dataset.img!));
  root.querySelectorAll<HTMLElement>('[data-img-bg]:not(.is-loaded)').forEach((el) => {
    const hero = el.closest('.hero');
    const first = hero ? [...hero.querySelectorAll('[data-img-bg]')].indexOf(el) < 2 : false;
    setPhoto(el, el.dataset.imgBg!, { eager: first });
  });
}

export function loadNow(el: HTMLElement) {
  io?.unobserve(el);
  load(el);
}

let watching = false;

export function watchImages() {
  if (watching) return;
  watching = true;
  hydrate();
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.matches('[data-img], [data-img-bg]')) hydrate(n.parentElement ?? n);
        else hydrate(n);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
