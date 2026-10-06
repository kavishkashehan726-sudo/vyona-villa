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
// The 3D villa is off at the client's request (October 2026). To bring it back, restore this
// import and the initVilla call, and drop `hidden` from the section and the menu link.
// import { initVilla } from './villa3d.js';
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
// initVilla(cap);
if (cap.cursor) {
  initCursor();
  initMagnetic();
}
if (cap.ripple) initRipple();

const barPrice = document.querySelector('[data-book-bar-price]');
const syncBar = () => (barPrice.textContent = money(lowestPrice()));
syncBar();
onCurrency(syncBar);
