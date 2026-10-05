// Magnetic buttons (frontend guide §4): the button leans toward the pointer
// with spring physics. Strength = offset / 3; spring 150 / 15 / 0.1.

import { animate } from 'motion';

const SPRING = { type: 'spring', stiffness: 150, damping: 15, mass: 0.1 } as const;
const bound = new WeakSet<Element>();

function bind(el: HTMLElement) {
  if (bound.has(el)) return;
  bound.add(el);
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / 3;
    const y = (e.clientY - (r.top + r.height / 2)) / 3;
    animate(el, { x, y }, SPRING);
  });
  el.addEventListener('pointerleave', () => animate(el, { x: 0, y: 0 }, SPRING));
}

export function initMagnetic() {
  const scan = () => document.querySelectorAll<HTMLElement>('.magnetic').forEach(bind);
  scan();
  // Pages, booking steps and dialogs render new buttons; pick them up as they appear.
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}
