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
};

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
