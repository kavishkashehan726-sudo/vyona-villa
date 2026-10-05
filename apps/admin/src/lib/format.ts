// Formatting shared by admin pages and client components. Stay dates are UTC
// calendar dates; timestamps show in the villa's time zone.

import { toDate } from '@vyona/core/dates';

export const VILLA_TZ = 'Asia/Colombo';

/** "$65" for nightly prices, or "US$337.70" with `exact` for totals. */
export function usd(cents: number, exact = false) {
  const value = cents / 100;
  if (exact) return `US$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(value) ? 0 : 2 })}`;
}

/** An amount in the currency it was charged in. */
export function money(cents: number, currency: string) {
  if (currency === 'USD') return usd(cents, true);
  return `${currency} ${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts });
const dayMonth = fmt({ day: 'numeric', month: 'short' });
const dayMonthYear = fmt({ day: 'numeric', month: 'short', year: 'numeric' });
const weekdayDate = fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const stamp = new Intl.DateTimeFormat('en-GB', { timeZone: VILLA_TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const asDate = (d: Date | number) => (typeof d === 'number' ? toDate(d) : d);

export const shortDate = (d: Date | number) => dayMonth.format(asDate(d));
export const longDate = (d: Date | number) => weekdayDate.format(asDate(d));
export const fullDate = (d: Date | number) => dayMonthYear.format(asDate(d));
/** A moment, in Sri Lanka time. */
export const when = (d: Date) => stamp.format(d);

/** "12 – 15 Dec 2026", or across months "28 Dec 2026 – 2 Jan 2027". */
export function stayRange(checkIn: Date | number, checkOut: Date | number) {
  const a = asDate(checkIn);
  const b = asDate(checkOut);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${fullDate(a)} – ${fullDate(b)}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${shortDate(a)} – ${fullDate(b)}`;
  return `${a.getUTCDate()} – ${fullDate(b)}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const STATUS_LABEL = {
  HOLD: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
} as const;

export const SOURCE_LABEL = {
  DIRECT: 'Website',
  BOOKING_COM: 'Booking.com',
  MANUAL: 'Entered by you',
} as const;
