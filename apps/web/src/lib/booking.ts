// Server side of the booking widget: request checks, the limiter, and the
// messages a guest sees when something can't be booked.

import { BookingError, type BookingErrorCode, type HoldInput } from '@vyona/core';

const NO_STORE = { 'Cache-Control': 'no-store' };

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: NO_STORE });

export const fail = (error: string, message: string, status = 400, field?: string) =>
  json({ error, message, ...(field ? { field } : {}) }, status);

const MESSAGES: Record<BookingErrorCode, string> = {
  INVALID_DATES: 'Those dates can’t be booked. Choose a check-in from today and a later check-out.',
  TOO_LONG: 'Stays are limited to 30 nights online. Message us for longer stays.',
  TOO_FAR_AHEAD: 'Bookings open 18 months ahead. Choose earlier dates.',
  ROOM_NOT_FOUND: 'That room can’t be booked online right now. Choose another room.',
  TOO_MANY_GUESTS: 'That room doesn’t sleep that many guests. Choose fewer guests or one of the studios.',
  MIN_STAY: 'Those dates are shorter than the minimum stay. Choose a later check-out.',
  UNAVAILABLE: 'Another guest has just taken one of those nights. Choose other dates.',
  HOLD_EXPIRED: 'Your hold ran out and the dates were released. Choose them again to continue.',
  NOT_HELD: 'This booking is no longer waiting for payment. Check your email for its status.',
};

const STATUS: Partial<Record<BookingErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  UNAVAILABLE: 409,
  MIN_STAY: 409,
  NOT_HELD: 409,
  HOLD_EXPIRED: 410,
};

/** A BookingError as a JSON response; anything else is rethrown. */
export function bookingFailure(err: unknown): Response {
  if (!(err instanceof BookingError)) throw err;
  const message = err.code === 'MIN_STAY' && err.message !== err.code ? `${err.message}. Choose a later check-out.` : MESSAGES[err.code];
  return fail(err.code, message, STATUS[err.code] ?? 400);
}

/* ------------------------------------------------------------ hold request */

type Parsed = { ok: true; room: string; input: Omit<HoldInput, 'roomId'> } | { ok: false; field: string; message: string };

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parseHold(body: unknown): Parsed {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const g = (b.guest && typeof b.guest === 'object' ? b.guest : {}) as Record<string, unknown>;
  const guests = Number(b.guests);
  const name = text(g.name, 120);
  const email = text(g.email, 200);
  const phone = text(g.phone, 40);

  if (!Number.isInteger(guests) || guests < 1 || guests > 20) return { ok: false, field: 'guests', message: 'Choose how many guests are staying.' };
  if (name.length < 2) return { ok: false, field: 'name', message: 'Enter the name the booking is for.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, field: 'email', message: 'Enter an email address like name@example.com.' };
  if (phone.replace(/\D/g, '').length < 6) return { ok: false, field: 'phone', message: 'Enter a phone or WhatsApp number, with the country code.' };

  return {
    ok: true,
    room: text(b.room, 40),
    input: {
      checkIn: text(b.checkIn, 10),
      checkOut: text(b.checkOut, 10),
      guests,
      guest: {
        name,
        email,
        phone,
        country: text(g.country, 60) || undefined,
        arrivalTime: text(g.arrival, 20) || undefined,
        notes: text(g.notes, 1000) || undefined,
      },
    },
  };
}

/* ----------------------------------------------------------------- limiter */

// Holds take rooms off sale for a quarter of an hour, so one connection may
// only make a few. In memory: the site runs as a single process.
const HOLD_LIMIT = 8;
const HOLD_WINDOW = 15 * 60_000;
const holds = new Map<string, number[]>();

const recent = (key: string, now: number) => (holds.get(key) ?? []).filter((t) => t > now - HOLD_WINDOW);

export function canHold(key: string, now = Date.now()) {
  return recent(key, now).length < HOLD_LIMIT;
}

export function countHold(key: string, now = Date.now()) {
  holds.set(key, [...recent(key, now), now]);
  if (holds.size > 5000) for (const k of holds.keys()) if (!recent(k, now).length) holds.delete(k);
}

/** The visitor's address as Cloudflare or the proxy reports it. */
export function clientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}
