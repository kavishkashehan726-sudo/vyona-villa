// Queues the Booking.com side of an owner's change. Kept out of the 'use
// server' files: everything exported from those becomes a callable action.

import { afterCancel, afterManualBooking, afterMove, afterRatesChange, pollBeds24Now, pullFromBeds24 } from '@vyona/core';

/** A save shouldn't fail because Redis is down; the fallback sync catches up later. */
async function queued(what: string, run: () => Promise<unknown>) {
  try {
    await run();
    return true;
  } catch (err) {
    console.error(`[admin] could not queue ${what}`, err);
    return false;
  }
}

export const syncRates = (range?: Parameters<typeof afterRatesChange>[0]) => queued('the rates update', () => afterRatesChange(range));
export const syncManual = (id: string, emailGuest: boolean) => queued('the new booking', () => afterManualBooking(id, emailGuest));
export const syncMove = (id: string) => queued('the moved booking', () => afterMove(id));
export const syncCancel = (id: string, emailGuest: boolean) => queued('the cancellation', () => afterCancel(id, emailGuest));
export const syncPoll = () => queued('the Booking.com check', pollBeds24Now);
export const syncPull = (bookingId: number) => queued('the Booking.com booking', () => pullFromBeds24(bookingId));
