// Gallery photos in display order: [photo key, filter, caption].

export type GalleryCat = 'rooms' | 'pool' | 'food' | 'spaces';

export const GALLERY_FILTERS: { value: GalleryCat | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'pool', label: 'Pool & garden' },
  { value: 'food', label: 'Food' },
  { value: 'spaces', label: 'Spaces' },
];

export const GALLERY: [key: string, cat: GalleryCat, alt: string][] = [
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
];
