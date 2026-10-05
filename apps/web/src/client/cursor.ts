// Dynamic cursor (frontend guide §4). Desktop/fine pointers only.
// A dot tracks the pointer exactly; a ring follows with easing and grows into
// a labelled disc over things you can open or book.

const INTERACTIVE = 'a, button, select, label, [data-cursor], [role="tab"]';
const LIGHT = '.hero, .statement, .pillar__img, .more, .welcome__quote, .lightbox, .villa3d__stage';

export function initCursor() {
  const c = document.querySelector<HTMLElement>('.cursor');
  const dot = c?.querySelector<HTMLElement>('.cursor__dot');
  const ring = c?.querySelector<HTMLElement>('.cursor__ring');
  const label = c?.querySelector<HTMLElement>('.cursor__label');
  if (!c || !dot || !ring || !label) return;
  document.documentElement.classList.add('has-cursor');

  let mx = -100;
  let my = -100;
  let rx = mx;
  let ry = my;
  let raf = 0;

  const loop = () => {
    rx += (mx - rx) * 0.2;
    ry += (my - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = Math.abs(mx - rx) + Math.abs(my - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      c.style.opacity = '1';
      if (!raf) raf = requestAnimationFrame(loop);
    },
    { passive: true },
  );
  document.addEventListener('pointerover', (e) => {
    const target = e.target as Element | null;
    const t = target?.closest?.<HTMLElement>(INTERACTIVE);
    const text = t?.dataset.cursor ?? '';
    c.classList.toggle('is-hover', Boolean(text));
    c.classList.toggle('is-link', Boolean(t) && !text);
    label.textContent = text;
    c.classList.toggle('is-light', Boolean(target?.closest?.(LIGHT)));
  });
  document.documentElement.addEventListener('pointerleave', () => (c.style.opacity = '0'));
}
