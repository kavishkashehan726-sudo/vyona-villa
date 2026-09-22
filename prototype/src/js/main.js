// VYONA prototype entry. Everything is bundled into one offline HTML file.

import { detect } from './capability.js';
import { hydrate } from './images.js';
import { initUI } from './ui.js';
import { initRooms, lowestPrice } from './rooms.js';
import { initGallery } from './gallery.js';
import { initBooking } from './booking.js';
import { initHero } from './hero.js';
import { initMotion } from './motion.js';
import { initMagnetic } from './magnetic.js';
import { initCursor } from './cursor.js';
import { initRipple } from './ripple.js';
import { initVilla } from './villa3d.js';
import { money, onCurrency } from './store.js';

const cap = detect();
const html = document.documentElement;
html.classList.add('js');
html.classList.toggle('is-lite', cap.low);
html.classList.toggle('is-reduced', cap.reduced);
window.__vyona = { cap };

hydrate();
initUI();
initRooms();
initGallery();
initBooking();
initHero(cap);
initMotion(cap);
initVilla(cap);
if (cap.cursor) {
  initCursor();
  initMagnetic();
}
if (cap.ripple) initRipple();

const barPrice = document.querySelector('[data-book-bar-price]');
const syncBar = () => (barPrice.textContent = money(lowestPrice()));
syncBar();
onCurrency(syncBar);
