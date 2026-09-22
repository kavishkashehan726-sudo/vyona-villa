// Masonry gallery with filters and a keyboard/swipe lightbox.

import { photo, setPhoto } from './images.js';
import { $, $$, lockScroll } from './ui.js';

const ITEMS = [
  ['hero-pool-aerial', 'pool', 'The pool from above, ringed by palms'],
  ['room-wide', 'rooms', 'A bright double room with timber floors'],
  ['breakfast-view', 'food', 'Breakfast looking out over the paddy fields'],
  ['verandah-swing', 'spaces', 'The verandah swing'],
  ['pool-long', 'pool', 'The length of the pool at midday'],
  ['room-curtains', 'rooms', 'Linen curtains and afternoon light'],
  ['dining-hall', 'spaces', 'The dining hall'],
  ['breakfast-fruit', 'food', 'A plate of fresh tropical fruit'],
  ['house-palm', 'pool', 'The house behind a coconut palm'],
  ['room-towels', 'rooms', 'Fresh towels folded on the bed'],
  ['kitchen', 'spaces', 'The guest kitchen'],
  ['pool-deck', 'pool', 'Loungers on the pool deck'],
  ['breakfast-tea', 'food', 'Ceylon tea on the terrace'],
  ['rocking-chair', 'spaces', 'A rocking chair in a quiet corner'],
  ['room-flowers', 'rooms', 'Temple flowers on the pillows'],
  ['garden-pool', 'pool', 'The garden path down to the pool'],
  ['dining-wide', 'spaces', 'Long tables in the dining hall'],
  ['kitchen-tea', 'food', 'Tea things laid out in the kitchen'],
  ['room-hall', 'rooms', 'The hallway to the rooms'],
  ['hero-pool-cottage', 'pool', 'The pool cottage at dusk'],
  ['bath-basin', 'rooms', 'A stone basin in an en-suite'],
  ['lounge-sofa', 'spaces', 'The lounge sofa'],
  ['breakfast-terrace', 'food', 'Breakfast laid out on the terrace'],
  ['door-vase', 'spaces', 'A carved door and a clay vase'],
  ['beach-hat', 'spaces', 'A sun hat, ready for the beach'],
  ['room-pillows', 'rooms', 'Crisp pillows and cotton throws'],
  ['kitchen-hob', 'food', 'The kitchen hob'],
  ['hat-rack', 'spaces', 'Hats by the door'],
].filter(([k]) => photo(k));

export function initGallery() {
  const grid = $('[data-gallery]');
  grid.innerHTML = ITEMS.map(
    ([, cat, alt], i) => `
    <li class="gallery__item reveal" data-cat="${cat}">
      <button class="gallery__btn ripple-host" data-index="${i}" data-cursor="View" aria-label="Open photo: ${alt}">
        <img class="ripple" alt="${alt}">
      </button>
    </li>`
  ).join('');
  const imgs = $$('img', grid);
  imgs.forEach((img, i) => setPhoto(img, ITEMS[i][0]));

  // Filters
  const chips = $$('[data-filter]');
  let visible = ITEMS.map((_, i) => i);
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      visible = [];
      $$('.gallery__item', grid).forEach((li, i) => {
        const show = f === 'all' || li.dataset.cat === f;
        li.hidden = !show;
        if (show) {
          visible.push(i);
          li.classList.add('is-in');
        }
      });
    })
  );

  // Lightbox
  const box = $('[data-lightbox]');
  if (!box.showModal) return;
  const big = $('[data-lightbox-img]');
  const cap = $('[data-lightbox-cap]');
  let pos = 0;
  const show = (n) => {
    pos = (n + visible.length) % visible.length;
    const [key, , alt] = ITEMS[visible[pos]];
    const p = photo(key);
    big.src = p.src;
    big.width = p.w;
    big.height = p.h;
    big.alt = alt;
    cap.textContent = `${alt} · ${pos + 1} / ${visible.length}`;
  };
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-index]');
    if (!b) return;
    show(visible.indexOf(Number(b.dataset.index)));
    box.showModal();
    lockScroll(true);
  });
  $('[data-lightbox-prev]').addEventListener('click', () => show(pos - 1));
  $('[data-lightbox-next]').addEventListener('click', () => show(pos + 1));
  $('[data-lightbox-close]').addEventListener('click', () => box.close());
  box.addEventListener('close', () => lockScroll(false));
  box.addEventListener('click', (e) => e.target === box && box.close());
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(pos - 1);
    if (e.key === 'ArrowRight') show(pos + 1);
  });
  let x0 = null;
  box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(pos + (dx < 0 ? 1 : -1));
    x0 = null;
  });
}
