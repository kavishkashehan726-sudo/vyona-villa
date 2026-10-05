// The slice of the Beds24 API v2 the villa uses, behind one interface so the
// mock and the real client are interchangeable. Dates are 'YYYY-MM-DD' and
// money is in the property's currency (dollars), as Beds24 sends them.

/** One run of nights with the same values. `to` is the last night, inclusive. */
export type CalendarRange = {
  from: string;
  to: string;
  price1: number;
  /** Null removes the minimum. */
  minStay: number | null;
  /** Blackout closes the nights on every channel; none leaves Beds24 to count bookings. */
  override: 'none' | 'blackout';
};

export type RoomCalendar = { roomId: number; calendar: CalendarRange[] };

export type Beds24Status = 'confirmed' | 'request' | 'new' | 'cancelled' | 'black' | 'inquiry';

/**
 * A booking as we send it. With `id` it modifies that booking, and fields left
 * out stay as they are (a moved Booking.com booking sends only its new room
 * and dates).
 */
export type OutBooking = {
  id?: number;
  roomId: number;
  arrival: string;
  departure: string;
  numAdult: number;
  status?: 'confirmed' | 'cancelled';
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  arrivalTime?: string;
  comments?: string;
  price?: number;
  /** Our ref, so a booking that comes back from Beds24 is recognised as ours. */
  apiReference?: string;
  referer?: string;
};

/** A booking as Beds24 returns it; only the fields we read. */
export type Beds24Booking = {
  id: number;
  roomId: number;
  status: Beds24Status;
  arrival: string;
  /** The check-out date. */
  departure: string;
  numAdult?: number;
  numChild?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  country?: string;
  country2?: string;
  arrivalTime?: string;
  comments?: string;
  price?: number;
  commission?: number;
  apiReference?: string;
  /** "booking" for Booking.com; empty for bookings made in Beds24 itself. */
  channel?: string;
  reference?: string;
  modifiedTime?: string;
};

export interface Beds24 {
  /** "beds24" talks to the real API; "mock" keeps everything locally. */
  readonly mode: 'beds24' | 'mock';
  setCalendar(rooms: RoomCalendar[]): Promise<void>;
  /** Creates the booking, or modifies it when `id` is set. Returns its id. */
  saveBooking(booking: OutBooking): Promise<number>;
  cancelBooking(id: number): Promise<void>;
  getBooking(id: number): Promise<Beds24Booking | null>;
  /** Our booking with this ref, if an earlier push got as far as Beds24. */
  findByReference(ref: string): Promise<Beds24Booking | null>;
  /** Every booking changed after `since`, cancellations included. */
  modifiedSince(since: Date): Promise<Beds24Booking[]>;
}

/** Beds24 refused or failed a request. Network and 5xx errors are worth retrying. */
export class Beds24Error extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
    this.name = 'Beds24Error';
  }
}
