// A stand-in for Beds24 until the villa has an account. It keeps bookings and
// the calendar in Redis (in memory for tests), so the worker's pushes can be
// inspected and the admin can sell a night "on Booking.com" to try the
// inbound side. Like the real channel, it won't sell a night that is closed
// or already booked, unless told to (to rehearse an overbooking).

import type { Redis } from 'ioredis';
import { Beds24Error, type Beds24, type Beds24Booking, type CalendarRange, type OutBooking, type RoomCalendar } from './types';

export interface MockStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  sadd(key: string, member: string): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
}

export function memoryStore(): MockStore {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    get: async (k) => kv.get(k) ?? null,
    set: async (k, v) => kv.set(k, v),
    incr: async (k) => {
      const n = Number(kv.get(k) ?? 0) + 1;
      kv.set(k, String(n));
      return n;
    },
    sadd: async (k, m) => sets.set(k, (sets.get(k) ?? new Set()).add(m)),
    smembers: async (k) => [...(sets.get(k) ?? [])],
  };
}

export const redisStore = (redis: Redis): MockStore => ({
  get: (k) => redis.get(k),
  set: (k, v) => redis.set(k, v),
  incr: (k) => redis.incr(k),
  sadd: (k, m) => redis.sadd(k, m),
  smembers: (k) => redis.smembers(k),
});

type Night = Omit<CalendarRange, 'from' | 'to'>;

const P = 'b24mock:';
const DAY = 86_400_000;
const nightsBetween = (from: string, until: string) => {
  const out: string[] = [];
  for (let t = Date.parse(from); t < Date.parse(until); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

export type ChannelSale = {
  roomId: number;
  arrival: string;
  departure: string;
  firstName: string;
  lastName: string;
  email?: string;
  numAdult?: number;
  /** Sell it even if the nights are closed or taken. */
  force?: boolean;
};

export class Beds24Mock implements Beds24 {
  readonly mode = 'mock' as const;

  constructor(private readonly store: MockStore = memoryStore()) {}

  /* ------------------------------------------------------------ calendar */

  async calendar(roomId: number): Promise<Record<string, Night>> {
    return JSON.parse((await this.store.get(`${P}calendar:${roomId}`)) ?? '{}');
  }

  async setCalendar(rooms: RoomCalendar[]) {
    for (const { roomId, calendar } of rooms) {
      const days = await this.calendar(roomId);
      for (const { from, to, ...night } of calendar) {
        for (const d of nightsBetween(from, new Date(Date.parse(to) + DAY).toISOString().slice(0, 10))) days[d] = night;
      }
      await this.store.set(`${P}calendar:${roomId}`, JSON.stringify(days));
    }
  }

  /* ------------------------------------------------------------ bookings */

  async bookings(): Promise<Beds24Booking[]> {
    const ids = await this.store.smembers(`${P}bookings`);
    const all = await Promise.all(ids.map((id) => this.getBooking(Number(id))));
    return all.filter((b): b is Beds24Booking => !!b).sort((a, b) => a.id - b.id);
  }

  private async put(booking: Beds24Booking) {
    booking.modifiedTime = new Date().toISOString().slice(0, 19);
    await this.store.set(`${P}booking:${booking.id}`, JSON.stringify(booking));
    await this.store.sadd(`${P}bookings`, String(booking.id));
    return booking;
  }

  async getBooking(id: number) {
    const raw = await this.store.get(`${P}booking:${id}`);
    return raw ? (JSON.parse(raw) as Beds24Booking) : null;
  }

  async saveBooking(b: OutBooking) {
    const current = b.id ? await this.getBooking(b.id) : null;
    if (b.id && !current) throw new Beds24Error(`No booking ${b.id}`, 400);
    const id = current?.id ?? 10_000_000 + (await this.store.incr(`${P}seq`));
    const fields = Object.fromEntries(Object.entries(b).filter(([k, v]) => k !== 'id' && v !== undefined));
    await this.put({ status: 'confirmed', channel: '', ...current, ...fields, id } as Beds24Booking);
    return id;
  }

  async cancelBooking(id: number) {
    const current = await this.getBooking(id);
    if (!current) throw new Beds24Error(`No booking ${id}`, 400);
    await this.put({ ...current, status: 'cancelled' });
  }

  async findByReference(ref: string) {
    return (await this.bookings()).find((b) => b.apiReference === ref) ?? null;
  }

  async modifiedSince(since: Date) {
    const from = since.toISOString().slice(0, 19);
    return (await this.bookings()).filter((b) => (b.modifiedTime ?? '') > from);
  }

  /* ------------------------------------------- the Booking.com side, for dev */

  /** Why the nights can't be sold, or null when they can. */
  async unsellable(roomId: number, arrival: string, departure: string, except?: number) {
    const nights = nightsBetween(arrival, departure);
    const days = await this.calendar(roomId);
    const closed = nights.filter((d) => days[d]?.override === 'blackout');
    if (closed.length) return `closed on ${closed.join(', ')}`;
    const taken = (await this.bookings()).filter(
      (b) => b.id !== except && b.roomId === roomId && b.status !== 'cancelled' && b.status !== 'inquiry' && b.arrival < departure && b.departure > arrival,
    );
    if (taken.length) return `already booked (${taken.map((b) => b.apiReference || b.id).join(', ')})`;
    const first = days[arrival]?.minStay;
    if (first && nights.length < first) return `the minimum stay from ${arrival} is ${first} nights`;
    return null;
  }

  /** A guest books on Booking.com: Beds24 records it, priced from the calendar. */
  async sell(sale: ChannelSale): Promise<Beds24Booking> {
    if (!(sale.departure > sale.arrival)) throw new Beds24Error('Departure must be after arrival', 400);
    if (!sale.force) {
      const why = await this.unsellable(sale.roomId, sale.arrival, sale.departure);
      if (why) throw new Beds24Error(`Booking.com would not sell this: ${why}`, 409);
    }
    const days = await this.calendar(sale.roomId);
    const price = nightsBetween(sale.arrival, sale.departure).reduce((sum, d) => sum + (days[d]?.price1 ?? 0), 0);
    return this.put({
      id: 10_000_000 + (await this.store.incr(`${P}seq`)),
      roomId: sale.roomId,
      status: 'new',
      arrival: sale.arrival,
      departure: sale.departure,
      numAdult: sale.numAdult ?? 2,
      numChild: 0,
      firstName: sale.firstName,
      lastName: sale.lastName,
      email: sale.email ?? '',
      phone: '',
      country2: '',
      price,
      commission: Math.round(price * 15) / 100,
      channel: 'booking',
      reference: String(4_000_000_000 + Math.floor(Math.random() * 99_999_999)),
    });
  }

  /** The guest cancels on Booking.com. */
  async cancelSale(id: number) {
    await this.cancelBooking(id);
  }
}
