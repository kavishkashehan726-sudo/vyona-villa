// Room data from the client's "STAY - rooms content" brief (feedback session 1).
// Prices are the client's "From" rates in USD. Photos follow the client's
// folders by room (Nov 2026); rooms 1 and 2 are the studios and share one folder.

export const ROOMS = [
  {
    number: 1, slug: 'dhara', name: 'Dhara', element: 'Earth', icon: 'earth',
    keywords: ['Grounded', 'Natural', 'Restful'],
    category: 'Studio', sizeSqm: 26, maxGuests: 3, baseRate: 9500,
    features: ['King-size bed + single bed', 'Fully equipped kitchen', 'En-suite bathroom', 'Ground floor', 'Rice-field, pool & landscape view'],
    photos: ['room-dhara', 'studio-garden', 'studio-kitchen'],
  },
  {
    number: 2, slug: 'jala', name: 'Jala', element: 'Water', icon: 'water',
    keywords: ['Fresh', 'Fluid', 'Serene'],
    category: 'Studio', sizeSqm: 26, maxGuests: 3, baseRate: 9500,
    features: ['King-size bed + single bed', 'Fully equipped kitchen', 'En-suite bathroom', 'Ground floor', 'Rice-field, pool & landscape view'],
    photos: ['room-jala', 'studio-evening', 'studio-galley'],
  },
  {
    number: 3, slug: 'vayu', name: 'Vayu', element: 'Air', icon: 'air',
    keywords: ['Airy', 'Light', 'Free'],
    category: 'Spacious king room', sizeSqm: 23, maxGuests: 2, baseRate: 6500,
    features: ['King-size bed', 'First floor · Corner room', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view', 'Work desk'],
    photos: ['room-vayu', 'vayu-balcony', 'vayu-bed', 'vayu-desk'],
  },
  {
    number: 4, slug: 'agni', name: 'Agni', element: 'Fire', icon: 'fire',
    keywords: ['Warm', 'Vibrant', 'Characterful'],
    category: 'Spacious king room', sizeSqm: 26, maxGuests: 2, baseRate: 6500,
    features: ['King-size bed', 'First floor', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view', 'Work desk'],
    photos: ['room-agni', 'agni-bed', 'agni-desk', 'bath-shower'],
  },
  {
    number: 5, slug: 'soma', name: 'Soma', element: 'Moon', icon: 'moon',
    keywords: ['Soft', 'Quiet', 'Restful'],
    category: 'Spacious king room', sizeSqm: 26, maxGuests: 2, baseRate: 6500,
    features: ['King-size bed', 'First floor · Corner room', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view', 'Work desk'],
    photos: ['room-soma', 'soma-lamp', 'soma-night', 'bath-towels'],
  },
  {
    number: 6, slug: 'surya', name: 'Surya', element: 'Sun', icon: 'sun',
    keywords: ['Bright', 'Warm', 'Joyful'],
    category: 'King room', sizeSqm: 19, maxGuests: 2, baseRate: 5000,
    features: ['King-size bed', 'Second floor · Corner room', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view'],
    photos: ['room-surya', 'surya-view', 'surya-wide'],
  },
  {
    // Keywords not supplied yet: the page hides the line until the client sends them.
    number: 7, slug: 'tara', name: 'Tara', element: 'Star', icon: 'star',
    keywords: [],
    category: 'Spacious king room', sizeSqm: 25, maxGuests: 2, baseRate: 7500,
    features: ['King-size bed', 'Second floor · Corner room', 'Private balcony', 'Rice-field, pool & landscape outlook', 'Work desk'],
    photos: ['room-vyoma', 'tara-view', 'tara-wide', 'tara-evening'],
  },
];

// The photos each room was first seeded with. media:import moves a room still
// showing exactly these to the list above; one the owner changed keeps its own.
export const LEGACY_ROOM_PHOTOS: Record<string, string[]> = {
  dhara: ['room-dhara', 'room-towels', 'bath-basin'],
  jala: ['room-jala', 'room-curtains', 'bath-mirror'],
  vayu: ['room-vayu', 'room-fan', 'verandah-swing'],
  agni: ['room-agni', 'room-light', 'wardrobe-mirror'],
  soma: ['room-soma', 'room-pillows', 'lamp-door'],
  surya: ['room-surya', 'room-flowers', 'breakfast-terrace'],
  tara: ['room-vyoma', 'room-wide', 'balcony-chair'],
};

// Carried over from the prototype. Placeholders until the client sets real seasons.
export const RATE_RULES = [
  { name: 'Peak season (Dec–Mar)', months: [12, 1, 2, 3], weekdays: [], percent: 20, sort: 0 },
  { name: 'Friday & Saturday nights', months: [], weekdays: [5, 6], percent: 12, sort: 1 },
];

export const SETTINGS: Record<string, unknown> = {
  serviceChargePercent: 10, // placeholder: client to confirm tax and service rules
  longStayNights: 7,
  longStayPercent: 10,
  lkrPerUsd: 300, // placeholder rate
  holdMinutes: 15,
  chargeCurrency: 'USD', // switch to LKR if the PayHere account can't settle USD
  checkInTime: '14:00', // placeholder
  checkOutTime: '11:00', // placeholder
  payAtVilla: false, // client to decide whether guests may pay on arrival
  onlineBooking: true, // off sends every Book button to bookingComUrl
  bookingComUrl: '',
};
