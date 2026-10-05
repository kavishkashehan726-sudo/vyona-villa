import { describe, expect, it } from 'vitest';
import { dayState } from './availability';
import { nightsOf, parseDay, toIso, today } from './dates';
import { nightlyRate, quote, type Rule } from './pricing';
import { DEFAULT_SETTINGS } from './settings';

// The seeded rules: the prototype's hard-coded season and weekend uplifts.
const RULES: Rule[] = [
  { months: [12, 1, 2, 3], weekdays: [], percent: 20 },
  { months: [], weekdays: [5, 6], percent: 12 },
];

// prototype/src/js/booking.js nightly(), in dollars, kept verbatim as the reference.
function prototypeNightly(price: number, n: number) {
  const d = new Date(n * 86_400_000);
  let p = price;
  const m = d.getUTCMonth();
  if (m === 11 || m <= 2) p *= 1.2;
  const dow = d.getUTCDay();
  if (dow === 5 || dow === 6) p *= 1.12;
  return Math.round(p);
}

const day = (iso: string) => parseDay(iso)!;

describe('dates', () => {
  it('parses real dates only', () => {
    expect(parseDay('2026-12-24')).toBe(20811);
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('24/12/2026')).toBeNull();
    expect(toIso(20811)).toBe('2026-12-24');
  });

  it("uses the villa's date, not UTC", () => {
    // 20:00 UTC is 01:30 the next morning in Sri Lanka.
    expect(toIso(today(new Date('2026-10-05T20:00:00Z')))).toBe('2026-10-06');
    expect(toIso(today(new Date('2026-10-05T18:00:00Z')))).toBe('2026-10-05');
  });
});

describe('nightlyRate', () => {
  it('matches the prototype for every night of a year at every room price', () => {
    const start = day('2027-01-01');
    for (const dollars of [50, 65, 75, 95]) {
      for (const n of nightsOf(start, start + 365)) {
        expect(nightlyRate(dollars * 100, n, RULES)).toBe(prototypeNightly(dollars, n) * 100);
      }
    }
  });

  it('compounds peak season with the weekend', () => {
    expect(nightlyRate(9500, day('2026-12-26'), RULES)).toBe(12800); // Sat in Dec: 95 × 1.2 × 1.12
    expect(nightlyRate(9500, day('2026-12-24'), RULES)).toBe(11400); // Thu in Dec
    expect(nightlyRate(9500, day('2026-10-09'), RULES)).toBe(10600); // Fri in Oct
    expect(nightlyRate(9500, day('2026-10-07'), RULES)).toBe(9500); // Wed in Oct
  });

  it('applies discounts as negative percentages', () => {
    expect(nightlyRate(10000, day('2026-06-03'), [{ months: [6], weekdays: [], percent: -15 }])).toBe(8500);
  });
});

describe('quote', () => {
  const base = { baseRate: 6500, rules: RULES, settings: DEFAULT_SETTINGS };

  it('adds the service charge to a short stay', () => {
    // Wed–Sat in October: 65, 65, 73 (Fri).
    const q = quote({ ...base, checkIn: day('2026-10-07'), checkOut: day('2026-10-10') });
    expect(q.nights.map((n) => n.price)).toEqual([6500, 6500, 7300]);
    expect(q).toMatchObject({ subtotal: 20300, discount: 0, serviceCharge: 2030, total: 22330 });
  });

  it('takes the long-stay discount off before the service charge', () => {
    // Mon 2026-10-05 for 7 nights: five at 65, Fri and Sat at 73.
    const q = quote({ ...base, checkIn: day('2026-10-05'), checkOut: day('2026-10-12') });
    expect(q.subtotal).toBe(47100);
    expect(q.discount).toBe(4710);
    expect(q.serviceCharge).toBe(4239);
    expect(q.total).toBe(46629);
  });

  it("uses the owner's price for a night over the rules", () => {
    const checkIn = day('2026-10-07');
    const q = quote({ ...base, checkIn, checkOut: checkIn + 2, overrides: new Map([[checkIn + 1, 12000]]) });
    expect(q.nights.map((n) => n.price)).toEqual([6500, 12000]);
  });
});

describe('dayState', () => {
  const now = new Date('2026-10-05T06:00:00Z');
  const d = day('2026-10-10');
  const later = new Date(now.getTime() + 60_000);
  const earlier = new Date(now.getTime() - 60_000);

  it('maps rows to the SRS calendar states', () => {
    expect(dayState(day('2026-10-04'), undefined, now)).toBe('past');
    expect(dayState(d, undefined, now)).toBe('free');
    expect(dayState(d, { blocked: true, reservation: null }, now)).toBe('booked');
    expect(dayState(d, { blocked: false, reservation: { status: 'CONFIRMED', holdUntil: null } }, now)).toBe('booked');
    expect(dayState(d, { blocked: false, reservation: { status: 'HOLD', holdUntil: later } }, now)).toBe('reserved');
    expect(dayState(d, { blocked: false, reservation: { status: 'HOLD', holdUntil: earlier } }, now)).toBe('free');
  });
});
