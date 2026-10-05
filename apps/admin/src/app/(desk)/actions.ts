'use server';

import { revalidatePath } from 'next/cache';
import { setNights, type NightsChange } from '@vyona/core';
import { parseDay, toIso } from '@vyona/core/dates';
import { attempt, cents, fail, int, ok, text, type Result } from '@/lib/actions';
import { plural } from '@/lib/format';
import { requireAdmin } from '@/lib/session';
import { syncRates } from '@/lib/sync';

const DONE: Record<string, (n: string) => string> = {
  close: (n) => `Closed ${n} to guests.`,
  open: (n) => `Opened ${n} to guests.`,
  price: (n) => `Set the price for ${n}.`,
  'reset-price': (n) => `${n.charAt(0).toUpperCase()}${n.slice(1)} back to the usual price.`,
  min: (n) => `Set a minimum stay from ${n}.`,
  'clear-min': (n) => `Removed the minimum stay from ${n}.`,
};

/** The calendar's selection panel: one change to a block of nights across one or more rooms. */
export async function changeNights(_prev: Result, fd: FormData): Promise<Result> {
  await requireAdmin();
  return attempt(async () => {
    const op = text(fd, 'op', 20);
    const roomIds = text(fd, 'rooms', 2000).split(',').filter(Boolean);
    const from = parseDay(text(fd, 'from', 10));
    const until = parseDay(text(fd, 'until', 10));
    if (from === null || until === null) return fail('Choose some nights first.');

    let change: NightsChange;
    if (op === 'close') change = { blocked: true };
    else if (op === 'open') change = { blocked: false };
    else if (op === 'price') {
      const price = cents(text(fd, 'price', 20));
      if (price === null) return fail('Enter the nightly price in dollars, like 85.');
      change = { price };
    } else if (op === 'reset-price') change = { price: null };
    else if (op === 'min') {
      const minStay = int(text(fd, 'minStay', 3));
      if (minStay === null) return fail('Enter the minimum stay in nights.');
      change = { minStay: minStay <= 1 ? null : minStay };
    } else if (op === 'clear-min') change = { minStay: null };
    else return fail('Choose what to do with these nights.');

    const { nights, booked } = await setNights(roomIds, from, until, change);
    await syncRates({ roomIds, from: toIso(from), until: toIso(until) });
    revalidatePath('/', 'layout');

    let message = DONE[op]!(plural(nights, 'night'));
    if (op === 'close' && booked) {
      message += ` ${plural(booked, 'of them is', 'of them are')} already booked; those bookings stand. Cancel them under Bookings if they shouldn’t.`;
    }
    return ok(message);
  });
}
