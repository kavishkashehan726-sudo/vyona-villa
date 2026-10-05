// Data the layout inlines once as <script id="vy-boot" type="application/json">.
// Read lazily, because page components mount before the layout's runtime does.

import type { PricingSettings } from '@vyona/core/pricing';

export type ClientPhoto = { src: string; w: number; h: number };

export type BookingRoom = {
  slug: string;
  number: number;
  name: string;
  element: string;
  maxGuests: number;
  baseRate: number;
  photo: string;
};

export type BootData = {
  photos: Record<string, ClientPhoto>;
  rooms: BookingRoom[];
  settings: PricingSettings & { lkrPerUsd: number; holdMinutes: number };
};

let data: BootData | null = null;

export function boot(): BootData {
  if (data) return data;
  try {
    data = JSON.parse(document.getElementById('vy-boot')?.textContent ?? '') as BootData;
  } catch {
    data = {
      photos: {},
      rooms: [],
      settings: { serviceChargePercent: 10, longStayNights: 7, longStayPercent: 10, lkrPerUsd: 300, holdMinutes: 15 },
    };
  }
  return data;
}
