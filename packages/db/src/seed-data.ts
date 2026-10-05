// Room data from the client's "STAY - rooms content" brief (feedback session 1).
// Prices are the client's "From" rates in USD. The room-to-photo pairings are
// still ours and need the client's confirmation.

export const ROOMS = [
  {
    number: 1, slug: 'dhara', name: 'Dhara', element: 'Earth', icon: 'earth',
    keywords: ['Grounded', 'Natural', 'Restful'],
    category: 'Studio', sizeSqm: 26, maxGuests: 3, baseRate: 9500,
    features: ['King-size bed + single bed', 'Fully equipped kitchen', 'En-suite bathroom', 'Ground floor', 'Rice-field, pool & landscape view'],
    photos: ['room-dhara', 'room-towels', 'bath-basin'],
  },
  {
    number: 2, slug: 'jala', name: 'Jala', element: 'Water', icon: 'water',
    keywords: ['Fresh', 'Fluid', 'Serene'],
    category: 'Studio', sizeSqm: 26, maxGuests: 3, baseRate: 9500,
    features: ['King-size bed + single bed', 'Fully equipped kitchen', 'En-suite bathroom', 'Ground floor', 'Rice-field, pool & landscape view'],
    photos: ['room-jala', 'room-curtains', 'bath-mirror'],
  },
  {
    number: 3, slug: 'vayu', name: 'Vayu', element: 'Air', icon: 'air',
    keywords: ['Airy', 'Light', 'Free'],
    category: 'Spacious king room', sizeSqm: 23, maxGuests: 2, baseRate: 6500,
    features: ['King-size bed', 'First floor · Corner room', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view', 'Work desk'],
    photos: ['room-vayu', 'room-fan', 'verandah-swing'],
  },
  {
    number: 4, slug: 'agni', name: 'Agni', element: 'Fire', icon: 'fire',
    keywords: ['Warm', 'Vibrant', 'Characterful'],
    category: 'Spacious king room', sizeSqm: 26, maxGuests: 2, baseRate: 6500,
    features: ['King-size bed', 'First floor', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view', 'Work desk'],
    photos: ['room-agni', 'room-light', 'wardrobe-mirror'],
  },
  {
    number: 5, slug: 'soma', name: 'Soma', element: 'Moon', icon: 'moon',
    keywords: ['Soft', 'Quiet', 'Restful'],
    category: 'Spacious king room', sizeSqm: 26, maxGuests: 2, baseRate: 6500,
    features: ['King-size bed', 'First floor · Corner room', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view', 'Work desk'],
    photos: ['room-soma', 'room-pillows', 'lamp-door'],
  },
  {
    number: 6, slug: 'surya', name: 'Surya', element: 'Sun', icon: 'sun',
    keywords: ['Bright', 'Warm', 'Joyful'],
    category: 'King room', sizeSqm: 19, maxGuests: 2, baseRate: 5000,
    features: ['King-size bed', 'Second floor · Corner room', 'En-suite bathroom', 'Shared outdoor space', 'Rice-field, pool & landscape view'],
    photos: ['room-surya', 'room-flowers', 'breakfast-terrace'],
  },
  {
    // Keywords not supplied yet: the page hides the line until the client sends them.
    number: 7, slug: 'tara', name: 'Tara', element: 'Star', icon: 'star',
    keywords: [],
    category: 'Spacious king room', sizeSqm: 25, maxGuests: 2, baseRate: 7500,
    features: ['King-size bed', 'Second floor · Corner room', 'Private balcony', 'Rice-field, pool & landscape outlook', 'Work desk'],
    photos: ['room-vyoma', 'room-wide', 'balcony-chair'],
  },
];

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
};
