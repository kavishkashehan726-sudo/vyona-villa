// Blur-up image loading. The build embeds every photo as { src, lqip, w, h }
// in <script id="vy-images">. Elements start on the 24px blurred placeholder
// and swap to the full WebP once they approach the viewport.

const DATA = (() => {
  try {
    return JSON.parse(document.getElementById('vy-images').textContent);
  } catch {
    return {};
  }
})();

export const photo = (key) => DATA[key];

const io =
  'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            io.unobserve(e.target);
            load(e.target);
          }
        },
        { rootMargin: '600px 0px' }
      )
    : null;

function load(el) {
  const p = DATA[el.dataset.img || el.dataset.imgBg];
  if (!p || el.classList.contains('is-loaded')) return;
  const probe = new Image();
  probe.src = p.src;
  const done = () => {
    if (el.tagName === 'IMG') el.src = p.src;
    else el.style.backgroundImage = `url("${p.src}")`;
    el.classList.add('is-loaded');
  };
  (probe.decode ? probe.decode() : Promise.resolve()).then(done, done);
}

/** Point an element at a photo key and lazy-load it. */
export function setPhoto(el, key, { eager = false } = {}) {
  const p = DATA[key];
  if (!p) return;
  el.classList.remove('is-loaded');
  if (el.tagName === 'IMG') {
    el.dataset.img = key;
    el.width = p.w;
    el.height = p.h;
    el.src = p.lqip;
    el.decoding = 'async';
  } else {
    el.dataset.imgBg = key;
    el.style.backgroundImage = `url("${p.lqip}")`;
  }
  el.classList.add('blur-img');
  if (eager || !io) load(el);
  else io.observe(el);
}

/** Hydrate every [data-img] / [data-img-bg] under root. */
export function hydrate(root = document) {
  root.querySelectorAll('[data-img]').forEach((el) => setPhoto(el, el.dataset.img));
  root.querySelectorAll('[data-img-bg]').forEach((el, i) =>
    setPhoto(el, el.dataset.imgBg, { eager: el.closest('.hero') !== null && i < 2 })
  );
}

export function loadNow(el) {
  if (io) io.unobserve(el);
  load(el);
}
