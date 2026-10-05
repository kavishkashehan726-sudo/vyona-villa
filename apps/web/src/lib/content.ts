// Page copy that isn't in the database. The client's own words (feedback
// session 1) are marked as such; everything flagged `draft` is ours and
// waits for the client's copy.

import type { IconName } from '@vyona/ui';

export type StoryBlock = { photo: string; alt: string; eyebrow: string; title: string; text: string[] };

export type Pillar = {
  slug: 'vyona' | 'food' | 'beyond';
  title: string;
  tag: string;
  body: string;
  link: string;
  photo: string;
  alt: string;
  /** Parallax speed of the photo inside its frame. */
  depth: number;
  /** Shown over the photo until the client's own shot arrives. */
  slot?: string;
  story: StoryBlock[];
};

// Titles, taglines, body and link labels are the client's (EXPLORE on homepage).
// The story blocks on each pillar page are draft copy.
export const PILLARS: Pillar[] = [
  {
    slug: 'vyona',
    title: 'VYONA',
    tag: 'Sometimes the best plan is no plan at all.',
    body: 'The pool, gardens, quiet corners and places to gather. Swim, read, stretch, have another coffee — or simply stay exactly where you are.',
    link: 'Explore VYONA',
    photo: 'pool-swimmer',
    alt: 'A guest walks down to the pool beneath a shade sail',
    depth: 0.12,
    story: [
      {
        photo: 'pool-long',
        alt: 'The length of the pool at midday',
        eyebrow: 'The pool',
        title: 'Swim beneath the palms.',
        text: ['A long pool with loungers in sun and shade. Swim before breakfast, after the beach, or both.'],
      },
      {
        photo: 'garden-deck',
        alt: 'A timber deck with a table and chairs under tall trees',
        eyebrow: 'The gardens',
        title: 'Quiet corners, all over.',
        text: ['Paths between the palms lead to a timber deck, a swing on the verandah and places where nobody will look for you.'],
      },
      {
        photo: 'lounge-sofa',
        alt: 'The lounge sofa',
        eyebrow: 'Places to gather',
        title: 'Company when you want it.',
        text: ['The lounge and the long tables in the dining hall are there for when you feel like talking. The rest of the time, they are quiet.'],
      },
    ],
  },
  {
    slug: 'food',
    title: 'Food',
    tag: 'Fresh. Local. Simply good.',
    body: 'Food made here, with ingredients chosen close to home whenever we can — from the sea, the farm and the markets around us.',
    link: 'Come to the table',
    photo: 'breakfast-view',
    alt: 'Breakfast of fruit, eggs and coffee on a verandah overlooking paddy fields',
    depth: 0.18,
    story: [
      {
        photo: 'breakfast-terrace',
        alt: 'Breakfast laid out on the terrace',
        eyebrow: 'Breakfast',
        title: 'Start slowly.',
        text: ['Fruit, eggs and Ceylon tea on the terrace, looking out over the paddy fields.'],
      },
      {
        photo: 'breakfast-fruit',
        alt: 'A plate of fresh tropical fruit',
        eyebrow: 'From close to home',
        title: 'The sea, the farm, the market.',
        text: ['We buy from the people around us whenever we can, and cook with whatever is best that day.'],
      },
      {
        photo: 'dining-wide',
        alt: 'Long tables in the dining hall',
        eyebrow: 'The table',
        title: 'Made here.',
        text: ['Long tables in the dining hall, for the days you would rather not go anywhere at all.'],
      },
    ],
  },
  {
    slug: 'beyond',
    title: 'Beyond VYONA',
    tag: "There's more out there.",
    body: 'The beach is only the beginning. Weligama, the southern coast and a Sri Lanka worth taking your time over.',
    link: 'Explore Beyond VYONA',
    photo: 'beach-hat',
    alt: 'A sun hat, ready for the beach',
    depth: 0.1,
    slot: 'Beach photo to come',
    story: [
      {
        photo: 'beach-hat',
        alt: 'A sun hat, ready for the beach',
        eyebrow: 'Weligama',
        title: 'One kilometre to the sand.',
        text: ['A wide, gentle bay with surf for beginners, fishing boats at the far end and somewhere to eat all along it.'],
      },
      {
        photo: 'hat-rack',
        alt: 'Hats by the door',
        eyebrow: 'The south coast',
        title: 'Mirissa, Midigama, Galle.',
        text: ['Whale-watching boats, reef breaks and the old fort at Galle, all within easy reach by tuk-tuk or train.'],
      },
      {
        photo: 'door-vase',
        alt: 'A carved door and a clay vase',
        eyebrow: 'Sri Lanka',
        title: 'Worth taking your time over.',
        text: ['Tea country, temples and national parks. Tell us how long you have and we will help you plan the rest.'],
      },
    ],
  },
];

export const pillarBySlug = (slug: string) => PILLARS.find((p) => p.slug === slug);

// About: the client's sections, no copy yet.
export const ABOUT: StoryBlock[] = [
  {
    photo: 'door-statue',
    alt: 'A carved timber door beside a stone statue',
    eyebrow: 'How it began',
    title: 'The story of VYONA.',
    text: ['Placeholder: how VYONA came to be, in the hosts’ own words.'],
  },
  {
    photo: 'verandah-swing',
    alt: 'The verandah swing',
    eyebrow: 'Your hosts',
    title: 'Who you’ll meet.',
    text: ['Placeholder: an introduction to the hosts, with their photo.'],
  },
  {
    photo: 'kitchen',
    alt: 'The guest kitchen',
    eyebrow: 'The kitchen',
    title: 'Where the food comes from.',
    text: ['Placeholder: the hosts’ culinary background and how they cook.'],
  },
  {
    photo: 'garden-pool',
    alt: 'The garden path down to the pool',
    eyebrow: 'Community',
    title: 'Our neighbours.',
    text: ['Placeholder: the people, growers and places VYONA works with in Weligama.'],
  },
];

// Stay page, word for word from "STAY - rooms content".
export const EVERY_ROOM = [
  'King-size bed',
  'Private ensuite with hot water',
  'Air conditioning + ceiling fan',
  'Complimentary Wi-Fi',
  'Tea & coffee, whenever you like',
  'Hairdryer',
  'Wardrobe & storage',
  'Quality bed linen & towels',
];

export const AMENITIES: { icon: IconName; lines: [string, string] }[] = [
  { icon: 'leaf', lines: ['Seven unique rooms', 'with character'] },
  { icon: 'pool', lines: ['Swimming pool', 'amid tropical gardens'] },
  { icon: 'earth', lines: ['1 km from Weligama Beach', 'Close, yet peaceful'] },
  { icon: 'pin', lines: ['Local recommendations', 'from your hosts'] },
  { icon: 'heart', lines: ['A warm, personal', 'and relaxed stay'] },
];
