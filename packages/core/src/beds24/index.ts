// Picks the Beds24 client: the real API when BEDS24_REFRESH_TOKEN is set, the
// mock in development and tests, and nothing in production without a token
// (the site can go live before the villa's Beds24 account exists; sync is
// simply off until then).

import { createRedis } from '../queues';
import { Beds24Http } from './http';
import { Beds24Mock, redisStore } from './mock';
import type { Beds24 } from './types';

export * from './types';
export { Beds24Http } from './http';
export { Beds24Mock, memoryStore, type ChannelSale } from './mock';

const g = globalThis as unknown as { __vyonaBeds24?: Beds24; __vyonaBeds24Mock?: Beds24Mock };

export type Beds24Mode = 'beds24' | 'mock' | 'off';

export function beds24Mode(): Beds24Mode {
  if (g.__vyonaBeds24) return g.__vyonaBeds24.mode;
  if (process.env.BEDS24_REFRESH_TOKEN?.trim()) return 'beds24';
  return process.env.NODE_ENV === 'production' ? 'off' : 'mock';
}

/** The mock shared through Redis, for the admin's "sell on Booking.com" tool and the worker. */
export function beds24Mock(): Beds24Mock {
  return (g.__vyonaBeds24Mock ??= new Beds24Mock(redisStore(createRedis())));
}

export function beds24(): Beds24 | null {
  if (g.__vyonaBeds24) return g.__vyonaBeds24;
  const mode = beds24Mode();
  if (mode === 'off') return null;
  return (g.__vyonaBeds24 = mode === 'beds24' ? new Beds24Http(process.env.BEDS24_REFRESH_TOKEN!.trim()) : beds24Mock());
}

/** Tests swap in their own client. */
export function useBeds24(client: Beds24 | undefined) {
  g.__vyonaBeds24 = client;
}
