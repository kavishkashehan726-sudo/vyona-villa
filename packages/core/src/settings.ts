// Booking settings and rate rules as stored by the admin. Defaults match the
// seed, so a missing row never breaks a quote.

import { prisma } from '@vyona/db';
import type { PricingSettings, Rule } from './pricing';

export type BookingSettings = PricingSettings & {
  holdMinutes: number;
  lkrPerUsd: number;
  chargeCurrency: 'USD' | 'LKR';
  checkInTime: string;
  checkOutTime: string;
  /** Lets guests confirm without paying online. Off: every booking goes through PayHere. */
  payAtVilla: boolean;
  /** Guests book and pay on this website. Off: every Book button goes to `bookingComUrl`. */
  onlineBooking: boolean;
  /** The villa's Booking.com page, where guests book while online booking is off. */
  bookingComUrl: string;
};

export const DEFAULT_SETTINGS: BookingSettings = {
  serviceChargePercent: 10,
  longStayNights: 7,
  longStayPercent: 10,
  holdMinutes: 15,
  lkrPerUsd: 300,
  chargeCurrency: 'USD',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  payAtVilla: false,
  onlineBooking: true,
  bookingComUrl: '',
};

/** "booking.com/hotel/…" or a full https link → the https URL, or null if it isn't a Booking.com page. */
export function normaliseBookingComUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    if (host !== 'booking.com' && !host.endsWith('.booking.com')) return null;
    url.protocol = 'https:';
    return url.href;
  } catch {
    return null;
  }
}

/** Where Book buttons send guests instead of the website's own booking, or null to book here. */
export function externalBookingUrl(s: Pick<BookingSettings, 'onlineBooking' | 'bookingComUrl'>): string | null {
  if (s.onlineBooking) return null;
  return normaliseBookingComUrl(s.bookingComUrl);
}

type Db = Pick<typeof prisma, 'setting' | 'rateRule'>;

export async function loadSettings(db: Db = prisma): Promise<BookingSettings> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULT_SETTINGS, ...stored } as BookingSettings;
}

export async function loadRules(db: Db = prisma): Promise<Rule[]> {
  return db.rateRule.findMany({
    where: { active: true },
    orderBy: { sort: 'asc' },
    select: { months: true, weekdays: true, percent: true },
  });
}
