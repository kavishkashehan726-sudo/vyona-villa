// Nightly rates and stay quotes, ported from prototype/src/js/booking.js
// (nightly, quote) with the constants moved into RateRule rows and Settings.
// Pure: callers load rules and settings, so the same numbers come out of the
// public quote, the hold transaction and the admin grid.

import { nightsOf, toDate, toIso } from './dates';

export type Rule = { months: number[]; weekdays: number[]; percent: number };

export type PricingSettings = {
  serviceChargePercent: number;
  longStayNights: number;
  longStayPercent: number;
};

export type Quote = {
  currency: 'USD';
  nights: { date: string; price: number }[];
  subtotal: number;
  discount: number;
  serviceCharge: number;
  total: number;
};

/** Does a rule cover this night? Months are 1–12, weekdays 0 (Sun) – 6 (Sat); empty means any. */
function applies(rule: Rule, day: number) {
  const d = toDate(day);
  return (
    (rule.months.length === 0 || rule.months.includes(d.getUTCMonth() + 1)) &&
    (rule.weekdays.length === 0 || rule.weekdays.includes(d.getUTCDay()))
  );
}

/**
 * Price of one night in cents. Matching rules compound (peak season on a
 * Saturday is base × 1.20 × 1.12), and the result rounds to whole dollars so
 * guests see clean nightly prices, as in the prototype.
 */
export function nightlyRate(baseRate: number, day: number, rules: readonly Rule[]): number {
  let price = baseRate;
  for (const rule of rules) if (applies(rule, day)) price *= 1 + rule.percent / 100;
  return Math.round(price / 100) * 100;
}

export function quote(input: {
  baseRate: number;
  checkIn: number;
  checkOut: number;
  rules: readonly Rule[];
  settings: PricingSettings;
  /** Owner-set prices for single nights (cents), which replace the rules. */
  overrides?: ReadonlyMap<number, number>;
}): Quote {
  const { baseRate, rules, settings, overrides } = input;
  const nights = nightsOf(input.checkIn, input.checkOut).map((day) => ({
    date: toIso(day),
    price: overrides?.get(day) ?? nightlyRate(baseRate, day, rules),
  }));
  const subtotal = nights.reduce((sum, n) => sum + n.price, 0);
  const discount =
    nights.length >= settings.longStayNights
      ? Math.round((subtotal * settings.longStayPercent) / 100)
      : 0;
  const serviceCharge = Math.round(((subtotal - discount) * settings.serviceChargePercent) / 100);
  return {
    currency: 'USD',
    nights,
    subtotal,
    discount,
    serviceCharge,
    total: subtotal - discount + serviceCharge,
  };
}
