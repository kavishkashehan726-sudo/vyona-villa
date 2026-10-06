// Dynamic cursor (frontend guide §4). Desktop/fine pointers only.
// A dot tracks the pointer exactly; a ring follows with easing and grows into
// a labelled disc over things you can open or book.

const INTERACTIVE = 'a, button, select, label, [data-cursor], [role="tab"]';
const LIGHT = '.hero, .statement, .exp, .welcome__quote, .lightbox, .villa3d__stage';

export function initCursor() {
  const c = document.querySelector('.cursor');
  const dot = c.querySelector('.cursor__dot');
  const ring = c.querySelector('.cursor__ring');
  const label = c.querySelector('.cursor__label');
  document.documentElement.classList.add('has-cursor');

  // Modal dialogs (room details, the lightbox) sit in the top layer, above any z-index, so the
  // cursor would vanish under them. As a manual popover it is in the top layer too, and showing
  // it again after a dialog opens puts it back on top.
  if (typeof c.showPopover === 'function') {
    c.popover = 'manual';
    c.showPopover();
    new MutationObserver(() => {
      if (!document.querySelector('dialog:modal')) return;
      c.hidePopover();
      c.showPopover();
    }).observe(document.body, { subtree: true, attributeFilter: ['open'] });
  }

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
    { passive: true }
  );
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.(INTERACTIVE);
    const text = t?.dataset.cursor || '';
    c.classList.toggle('is-hover', Boolean(text));
    c.classList.toggle('is-link', Boolean(t) && !text);
    label.textContent = text;
    c.classList.toggle('is-light', Boolean(e.target.closest?.(LIGHT)));
  });
  document.documentElement.addEventListener('pointerleave', () => (c.style.opacity = '0'));
}
