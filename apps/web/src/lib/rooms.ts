// Room shape and formatting shared by server and client components (no database imports).

export type RoomData = {
  slug: string;
  number: number;
  name: string;
  element: string;
  icon: string;
  keywords: string[];
  category: string;
  sizeSqm: number;
  maxGuests: number;
  features: string[];
  baseRate: number;
  photos: string[];
};

/** "1 - DHARA", the card title format from the client's brief. */
export const roomTitle = (r: Pick<RoomData, 'number' | 'name'>) => `${r.number} - ${r.name.toUpperCase()}`;

/** "STUDIO · 26 M² · UP TO 3 GUESTS" (upper-cased by CSS). */
export const roomSpecs = (r: Pick<RoomData, 'category' | 'sizeSqm' | 'maxGuests'>) =>
  `${r.category} · ${r.sizeSqm} m² · up to ${r.maxGuests} guests`;

export const lowestRate = (rooms: RoomData[]) => Math.min(...rooms.map((r) => r.baseRate));
