// Gallery filters and the keyboard/swipe lightbox. The grid itself is
// server-rendered; each button carries its photo key and caption.

import { photo } from './images';
import { $, $$, lockScroll } from './ui';

export function initGallery(section: HTMLElement) {
  const ac = new AbortController();
  const { signal } = ac;
  const grid = $('[data-gallery]', section);
  if (!grid) return () => {};
  const items = $$('.gallery__item', grid);
  let visible = items.map((_, i) => i);

  // Filters
  const chips = $$('[data-filter]', section);
  chips.forEach((chip) =>
    chip.addEventListener(
      'click',
      () => {
        const f = chip.dataset.filter;
        chips.forEach((c) => {
          const on = c === chip;
          c.classList.toggle('is-active', on);
          c.setAttribute('aria-pressed', String(on));
        });
        visible = [];
        items.forEach((li, i) => {
          const show = f === 'all' || li.dataset.cat === f;
          li.hidden = !show;
          if (show) {
            visible.push(i);
            li.classList.add('is-in');
          }
        });
      },
      { signal },
    ),
  );

  // Lightbox
  const box = $<HTMLDialogElement>('[data-lightbox]', section);
  const big = box && $<HTMLImageElement>('[data-lightbox-img]', box);
  const cap = box && $('[data-lightbox-cap]', box);
  if (!box || !big || !cap || !box.showModal) return () => ac.abort();

  let pos = 0;
  const show = (n: number) => {
    pos = (n + visible.length) % visible.length;
    const btn = $('[data-key]', items[visible[pos]!]!)!;
    const p = photo(btn.dataset.key!);
    const alt = btn.dataset.alt ?? '';
    if (p) {
      big.src = p.src;
      big.width = p.w;
      big.height = p.h;
    }
    big.alt = alt;
    cap.textContent = `${alt} · ${pos + 1} / ${visible.length}`;
  };
  const on = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement | null,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts: AddEventListenerOptions = {},
  ) => el?.addEventListener(type, fn, { ...opts, signal });

  on(grid, 'click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-index]');
    if (!b) return;
    show(visible.indexOf(Number(b.dataset.index)));
    box.showModal();
    lockScroll(true);
  });
  on($('[data-lightbox-prev]', box), 'click', () => show(pos - 1));
  on($('[data-lightbox-next]', box), 'click', () => show(pos + 1));
  on($('[data-lightbox-close]', box), 'click', () => box.close());
  on(box, 'close', () => lockScroll(false));
  on(box, 'click', (e) => e.target === box && box.close());
  on(box, 'keydown', (e) => {
    if (e.key === 'ArrowLeft') show(pos - 1);
    if (e.key === 'ArrowRight') show(pos + 1);
  });
  let x0: number | null = null;
  on(box, 'touchstart', (e) => (x0 = e.touches[0]?.clientX ?? null), { passive: true });
  on(box, 'touchend', (e) => {
    const x1 = e.changedTouches[0]?.clientX;
    if (x0 === null || x1 === undefined) return;
    const dx = x1 - x0;
    if (Math.abs(dx) > 50) show(pos + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  return () => {
    const wasOpen = box.open;
    ac.abort();
    // The close event fires after the listeners are gone, so unlock here.
    if (wasOpen) {
      box.close();
      lockScroll(false);
    }
  };
}
