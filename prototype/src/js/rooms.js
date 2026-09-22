// The seven element rooms. Prices, beds, sizes and photo pairings are
// PLACEHOLDERS for the client to confirm (see diary.md).

import { setPhoto } from './images.js';
import { money, onCurrency } from './store.js';
import { $, lockScroll } from './ui.js';

export const ROOMS = [
  {
    id: 'dhara', name: 'Dhara', element: 'Earth', icon: 'i-earth', price: 85,
    guests: 2, bed: 'Queen bed', size: '24 m²', view: 'Garden',
    photos: ['room-dhara', 'room-towels', 'bath-basin'],
    blurb: 'Grounded and calm. Teak floors, clay tones and a window onto the garden, where the day starts with birdsong.',
    amen: ['Air conditioning', 'Ceiling fan', 'En-suite shower', 'Garden view', 'Wi-Fi'],
  },
  {
    id: 'jala', name: 'Jala', element: 'Water', icon: 'i-water', price: 95,
    guests: 2, bed: 'King bed', size: '26 m²', view: 'Pool',
    photos: ['room-jala', 'room-curtains', 'bath-mirror'],
    blurb: 'Soft linen and cool whites, a few steps from the pool. Fall asleep to the sound of water.',
    amen: ['Air conditioning', 'Pool access', 'En-suite shower', 'Rain shower', 'Wi-Fi'],
  },
  {
    id: 'agni', name: 'Agni', element: 'Fire', icon: 'i-fire', price: 110,
    guests: 3, bed: 'King + single', size: '30 m²', view: 'Palms',
    photos: ['room-agni', 'room-light', 'wardrobe-mirror'],
    blurb: 'Warm evening light and rich timber. Room for three, with a reading corner for slow afternoons.',
    amen: ['Air conditioning', 'Sofa corner', 'En-suite shower', 'Wardrobe', 'Wi-Fi'],
  },
  {
    id: 'vayu', name: 'Vayu', element: 'Wind', icon: 'i-wind', price: 95,
    guests: 2, bed: 'Queen bed', size: '25 m²', view: 'Verandah',
    photos: ['room-vayu', 'room-fan', 'verandah-swing'],
    blurb: 'Tall windows and a cross-breeze through the palms. Opens onto the verandah and its swing.',
    amen: ['Ceiling fan', 'Air conditioning', 'Verandah', 'En-suite shower', 'Wi-Fi'],
  },
  {
    id: 'vyoma', name: 'Vyoma', element: 'Sky', icon: 'i-sky', price: 140,
    guests: 4, bed: '2 queen beds', size: '38 m²', view: 'Pool & sky',
    photos: ['room-vyoma', 'room-wide', 'balcony-chair'],
    blurb: 'Our most open room, with space for four and a balcony that looks up through the trees.',
    amen: ['Air conditioning', 'Balcony', 'Family size', 'En-suite bath', 'Wi-Fi'],
  },
  {
    id: 'surya', name: 'Surya', element: 'Sun', icon: 'i-sun', price: 120,
    guests: 2, bed: 'King bed', size: '28 m²', view: 'East garden',
    photos: ['room-surya', 'room-flowers', 'breakfast-terrace'],
    blurb: 'Faces the morning. Wake to sun across the sheets, then breakfast on the terrace next door.',
    amen: ['Air conditioning', 'Morning light', 'En-suite shower', 'Terrace', 'Wi-Fi'],
  },
  {
    id: 'soma', name: 'Soma', element: 'Moon', icon: 'i-moon', price: 105,
    guests: 2, bed: 'Queen bed', size: '24 m²', view: 'Quiet corner',
    photos: ['room-soma', 'room-pillows', 'lamp-door'],
    blurb: 'The quietest room in the house. Low lamps, heavy curtains and deep sleep.',
    amen: ['Air conditioning', 'Blackout curtains', 'En-suite shower', 'Reading lamps', 'Wi-Fi'],
  },
];

export const roomById = (id) => ROOMS.find((r) => r.id === id);
export const lowestPrice = () => Math.min(...ROOMS.map((r) => r.price));

const icon = (id, cls = 'room-card__icon') =>
  `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

function renderCards() {
  const list = $('[data-rooms]');
  list.innerHTML = ROOMS.map(
    (r) => `
    <li class="room-card reveal">
      <button class="room-card__btn" data-room-open="${r.id}" data-cursor="Open" aria-label="${r.name}, the ${r.element} room. See details">
        <span class="room-card__img ripple-host"><img class="ripple" alt="${r.name} room at VYONA"></span>
        ${icon(r.icon)}
        <span class="room-card__name">${r.name.toUpperCase()}</span>
        <span class="room-card__meaning">${r.element}</span>
        <span class="room-card__price" data-price="${r.price}">From ${money(r.price)} / night</span>
      </button>
    </li>`
  ).join('');
  list.querySelectorAll('img').forEach((img, i) => setPhoto(img, ROOMS[i].photos[0]));
}

function initDialog() {
  const dlg = $('[data-room-dialog]');
  const media = $('[data-room-media]');
  const body = $('[data-room-body]');
  if (!dlg.showModal) return;

  const open = (id) => {
    const r = roomById(id);
    if (!r) return;
    media.innerHTML = r.photos.map((_, i) => `<img alt="${r.name} room, photo ${i + 1}">`).join('');
    media.querySelectorAll('img').forEach((img, i) => setPhoto(img, r.photos[i], { eager: true }));
    body.innerHTML = `
      ${icon(r.icon)}
      <p class="eyebrow">The ${r.element} room</p>
      <h2 class="h2" id="room-dialog-title">${r.name.toUpperCase()}</h2>
      <hr class="rule">
      <p>${r.blurb}</p>
      <dl class="room-dialog__facts">
        <div><dt>Sleeps</dt><dd>${r.guests} guests</dd></div>
        <div><dt>Bed</dt><dd>${r.bed}</dd></div>
        <div><dt>Size</dt><dd>${r.size}</dd></div>
        <div><dt>From</dt><dd data-price="${r.price}">${money(r.price)} / night</dd></div>
      </dl>
      <ul class="room-dialog__amen">${r.amen.map((a) => `<li>${a}</li>`).join('')}</ul>
      <button class="btn btn--olive magnetic" data-open-booking data-room="${r.id}" data-cursor="Book">Check dates for ${r.name}</button>
      <p class="proto-note">Room details are placeholders.</p>`;
    dlg.showModal();
    lockScroll(true);
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-room-open]');
    if (b) open(b.dataset.roomOpen);
  });
  $('[data-room-close]').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => e.target === dlg && dlg.close());
  dlg.addEventListener('close', () => lockScroll(false));
}

export function initRooms() {
  renderCards();
  initDialog();
  onCurrency(() =>
    document.querySelectorAll('[data-price]').forEach((el) => {
      const p = Number(el.dataset.price);
      el.textContent = el.classList.contains('room-card__price')
        ? `From ${money(p)} / night`
        : `${money(p)} / night`;
    })
  );
}
