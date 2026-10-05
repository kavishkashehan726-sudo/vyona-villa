// Stay dates are calendar dates with no time zone: 'YYYY-MM-DD' at the edges
// (URLs, JSON, the database) and epoch day numbers inside, the same scheme the
// prototype's calendar uses for data-day.

export const DAY_MS = 86_400_000;
export const VILLA_TZ = 'Asia/Colombo';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Epoch day for an ISO date, or null when the string is not a real date. */
export function parseDay(iso: string): number | null {
  const m = ISO.exec(iso);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const day = ms / DAY_MS;
  return toIso(day) === iso ? day : null; // rejects 2026-02-30
}

export function toIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** UTC midnight, the value Prisma expects for a @db.Date column. */
export function toDate(day: number): Date {
  return new Date(day * DAY_MS);
}

export function dayOf(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

/** Today's date at the villa, which decides what counts as a past night. */
export function today(now = new Date()): number {
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: VILLA_TZ }).format(now);
  return parseDay(iso)!;
}

/** The nights of a stay: check-in up to, not including, check-out. */
export function nightsOf(checkIn: number, checkOut: number): number[] {
  const out: number[] = [];
  for (let d = checkIn; d < checkOut; d++) out.push(d);
  return out;
}
