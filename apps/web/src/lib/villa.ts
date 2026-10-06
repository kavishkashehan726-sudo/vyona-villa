// The places in the 3D villa. Shared by the server markup (zone buttons,
// fallback slides) and the WebGL scene (camera targets, label anchors).

// Off at the client's request (October 2026), for now. Turning it back on brings back the home
// page section and its menu link; the scene, the water shader and the fallback are unchanged.
export const SHOW_VILLA_3D = false;

export type Vec3 = [x: number, y: number, z: number];

export type Zone = {
  id: string;
  name: string;
  eyebrow: string;
  text: string;
  photo: string;
  target: Vec3;
  az: number;
  anchor: Vec3;
};

export const ZONES: Zone[] = [
  {
    id: 'house', name: 'The rooms', eyebrow: 'Main house',
    text: 'Seven rooms open onto a shaded verandah, each named for an element. Teak floors, high ceilings and ceiling fans turning slowly.',
    photo: 'hero-house', target: [-1, 1.4, -5.2], az: 0.35, anchor: [-1, 4.6, -5.4],
  },
  {
    id: 'pool', name: 'The pool', eyebrow: 'Heart of the garden',
    text: 'A long pool framed by palms and a teak deck. Loungers in the sun, a shade sail for midday, and the first light of the morning across the water.',
    photo: 'pool-long', target: [0, 0.2, 1.4], az: 0.2, anchor: [0, 0.9, 1.4],
  },
  {
    id: 'cottage', name: 'Pool cottage', eyebrow: 'Upstairs rooms',
    text: 'Our two-storey cottage looks straight down onto the pool, with a balcony for watching the sun go down behind the palms.',
    photo: 'hero-pool-cottage', target: [7, 1.6, 0.6], az: 0.95, anchor: [7, 5.3, 0.6],
  },
  {
    id: 'terrace', name: 'Breakfast terrace', eyebrow: 'Mornings',
    text: 'Fresh fruit, eggs any way, hoppers and Ceylon tea, served under the pergola whenever you wake up.',
    photo: 'breakfast-terrace', target: [-7, 0.8, 1.6], az: -0.6, anchor: [-7, 3.1, 1.6],
  },
  {
    id: 'garden', name: 'Garden deck', eyebrow: 'Quiet corners',
    text: 'A timber deck under the big trees at the edge of the garden. Bring a book, or just listen to the birds.',
    photo: 'garden-deck', target: [-2.6, 0.6, 7.2], az: -0.15, anchor: [-2.6, 2.6, 7.2],
  },
];

/** Photo sequence for devices that get no WebGL. */
export const VILLA_SLIDES: [key: string, caption: string][] = [
  ['hero-pool-aerial', 'The pool from above'],
  ['pool-long', 'The pool'],
  ['hero-house', 'The main house'],
  ['hero-pool-cottage', 'The pool cottage'],
  ['breakfast-terrace', 'Breakfast terrace'],
  ['garden-deck', 'Garden deck'],
];
