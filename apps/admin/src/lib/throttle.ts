// Slows down password guessing: after 5 failed sign-ins for an email or from an
// address within 15 minutes, both are refused until the window passes. Kept in
// memory; the admin runs as one process.

const LIMIT = 5;
const WINDOW_MS = 15 * 60_000;

const g = globalThis as unknown as { __vyonaLogins?: Map<string, number[]> };
const failures: Map<string, number[]> = (g.__vyonaLogins ??= new Map());

const recent = (key: string, now: number) => (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

/** Minutes until another try is allowed, or 0. */
export function lockedFor(keys: string[], now = Date.now()): number {
  let until = 0;
  for (const key of keys) {
    const times = recent(key, now);
    if (times.length >= LIMIT) until = Math.max(until, times[0]! + WINDOW_MS);
  }
  return until ? Math.ceil((until - now) / 60_000) : 0;
}

export function recordFailure(keys: string[], now = Date.now()) {
  for (const key of keys) failures.set(key, [...recent(key, now), now]);
}

export function clearFailures(keys: string[]) {
  for (const key of keys) failures.delete(key);
}
