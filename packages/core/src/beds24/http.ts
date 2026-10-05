// The real Beds24 API v2 client. The refresh token (from Beds24 → Settings →
// Marketplace → API) buys a short-lived access token, cached here until a few
// minutes before it expires. Only the worker calls this.

import { Beds24Error, type Beds24, type Beds24Booking, type OutBooking, type RoomCalendar } from './types';

const BASE = 'https://beds24.com/api/v2';
const STATUSES = ['confirmed', 'request', 'new', 'cancelled', 'black', 'inquiry'];

type PostResult = {
  success: boolean;
  new?: { id?: number };
  modified?: { id?: number };
  errors?: { action?: string; field?: string; message?: string }[];
};

/** Beds24 wants UTC without a zone suffix: YYYY-MM-DDTHH:MM:SS. */
const stamp = (d: Date) => d.toISOString().slice(0, 19);

export class Beds24Http implements Beds24 {
  readonly mode = 'beds24' as const;
  private token: { value: string; until: number } | null = null;

  constructor(
    private readonly refreshToken: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async accessToken(force = false) {
    if (!force && this.token && this.token.until > Date.now()) return this.token.value;
    const res = await this.fetcher(`${BASE}/authentication/token`, { headers: { refreshToken: this.refreshToken } });
    const body = (await res.json().catch(() => ({}))) as { token?: string; expiresIn?: number; error?: string };
    if (!res.ok || !body.token) throw new Beds24Error(`Beds24 sign-in failed: ${body.error ?? res.status}`, res.status);
    this.token = { value: body.token, until: Date.now() + Math.max(60, (body.expiresIn ?? 3600) - 300) * 1000 };
    return body.token;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
    let res: Response;
    try {
      res = await this.fetcher(`${BASE}${path}`, {
        method,
        headers: { token: await this.accessToken(retried), accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      throw new Beds24Error(`Beds24 unreachable: ${(err as Error).message}`);
    }
    // A token can be revoked before it expires; sign in again once.
    if (res.status === 401 && !retried) return this.request(method, path, body, true);
    const json = (await res.json().catch(() => null)) as T & { error?: string };
    if (!res.ok) {
      const credits = res.headers.get('X-FiveMinCreditLimit-Remaining');
      throw new Beds24Error(
        `Beds24 ${method} ${path.split('?')[0]} → ${res.status}: ${json?.error ?? res.statusText}${credits ? ` (credits left ${credits})` : ''}`,
        res.status,
      );
    }
    return json;
  }

  /** Throws with every error Beds24 listed for a batch write. */
  private check(results: PostResult[], what: string) {
    const failed = (Array.isArray(results) ? results : [results]).filter((r) => !r.success);
    if (failed.length) {
      const why = failed.flatMap((r) => r.errors ?? []).map((e) => [e.field, e.message].filter(Boolean).join(': '));
      throw new Beds24Error(`Beds24 rejected ${what}: ${why.join('; ') || 'no reason given'}`, 400);
    }
  }

  async setCalendar(rooms: RoomCalendar[]) {
    if (!rooms.length) return;
    this.check(await this.request<PostResult[]>('POST', '/inventory/rooms/calendar', rooms), 'the calendar');
  }

  async saveBooking(booking: OutBooking) {
    const [result] = await this.request<PostResult[]>('POST', '/bookings', [booking]);
    const name = booking.apiReference ?? booking.id;
    this.check([result!], `booking ${name}`);
    const id = result!.new?.id ?? result!.modified?.id ?? booking.id;
    if (!id) throw new Beds24Error(`Beds24 saved ${name} but returned no id`);
    return id;
  }

  async cancelBooking(id: number) {
    this.check(await this.request<PostResult[]>('POST', '/bookings', [{ id, status: 'cancelled' }]), `the cancellation of ${id}`);
  }

  private async list(query: URLSearchParams) {
    for (const s of STATUSES) query.append('status', s);
    const out: Beds24Booking[] = [];
    for (let page = 1; page <= 50; page++) {
      query.set('page', String(page));
      const res = await this.request<{ data?: Beds24Booking[]; pages?: { nextPageExists?: boolean } }>('GET', `/bookings?${query}`);
      out.push(...(res.data ?? []));
      if (!res.pages?.nextPageExists) break;
    }
    return out;
  }

  async getBooking(id: number) {
    const [booking] = await this.list(new URLSearchParams({ id: String(id) }));
    return booking ?? null;
  }

  async findByReference(ref: string) {
    const [booking] = await this.list(new URLSearchParams({ apiReference: ref }));
    return booking ?? null;
  }

  async modifiedSince(since: Date) {
    return this.list(new URLSearchParams({ modifiedFrom: stamp(since) }));
  }
}
