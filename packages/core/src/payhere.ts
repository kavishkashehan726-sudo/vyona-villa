// PayHere Checkout API: the signed form the browser posts to PayHere, and the
// check on the server-to-server notify that reports the payment.
// https://support.payhere.lk/api-&-mobile-sdk/checkout-api
//
// No database access here, so it is unit-tested on its own.

import { createHash, timingSafeEqual } from 'node:crypto';

export const PAYHERE_SANDBOX_URL = 'https://sandbox.payhere.lk/pay/checkout';
export const PAYHERE_LIVE_URL = 'https://www.payhere.lk/pay/checkout';
/** The stand-in gateway in apps/web, used in development without an account. */
export const PAYHERE_MOCK_URL = '/book/pay/mock';

export type PayHereConfig = {
  merchantId: string;
  secret: string;
  checkoutUrl: string;
  mock: boolean;
};

/**
 * Credentials from the environment. Without them, development gets the mock
 * gateway; production gets null, so card payment is switched off rather than
 * faked.
 */
export function payhereConfig(env: Record<string, string | undefined> = process.env): PayHereConfig | null {
  const merchantId = env.PAYHERE_MERCHANT_ID?.trim();
  const secret = env.PAYHERE_MERCHANT_SECRET?.trim();
  if (merchantId && secret) {
    const checkoutUrl = env.PAYHERE_SANDBOX === '0' ? PAYHERE_LIVE_URL : PAYHERE_SANDBOX_URL;
    return { merchantId, secret, checkoutUrl, mock: false };
  }
  if (env.NODE_ENV !== 'production') {
    return { merchantId: 'MOCK', secret: 'mock-secret', checkoutUrl: PAYHERE_MOCK_URL, mock: true };
  }
  return null;
}

const md5 = (s: string) => createHash('md5').update(s).digest('hex').toUpperCase();

/** Cents as PayHere writes amounts: two decimals, no thousands separator ("1234.50"). */
export function payhereAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError(`Bad amount: ${cents}`);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

export type CheckoutInput = {
  orderId: string;
  /** Cents in `currency`. */
  amount: number;
  currency: 'USD' | 'LKR';
  items: string;
  guest: { name: string; email: string; phone: string; country?: string | null };
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

export function checkoutFields(cfg: PayHereConfig, input: CheckoutInput): Record<string, string> {
  const [first = '', ...rest] = input.guest.name.trim().split(/\s+/);
  const amount = payhereAmount(input.amount);
  return {
    merchant_id: cfg.merchantId,
    return_url: input.returnUrl,
    cancel_url: input.cancelUrl,
    notify_url: input.notifyUrl,
    first_name: first,
    last_name: rest.join(' ') || first,
    email: input.guest.email,
    phone: input.guest.phone,
    // Required by PayHere, but a villa booking has no use for a billing address.
    address: 'Not provided',
    city: 'Not provided',
    country: input.guest.country || 'Sri Lanka',
    order_id: input.orderId,
    items: input.items,
    currency: input.currency,
    amount,
    hash: md5(cfg.merchantId + input.orderId + amount + input.currency + md5(cfg.secret)),
  };
}

/** True if a checkout form's hash is what this merchant would have signed. */
export function verifyCheckout(cfg: PayHereConfig, f: Record<string, string | undefined>): boolean {
  if (f.merchant_id !== cfg.merchantId || !f.hash) return false;
  const want = Buffer.from(md5(cfg.merchantId + f.order_id + f.amount + f.currency + md5(cfg.secret)));
  const got = Buffer.from(f.hash);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** The fields PayHere posts to notify_url that this app reads. */
export type PayHereNotify = {
  merchant_id: string;
  order_id: string;
  payment_id?: string;
  payhere_amount: string;
  payhere_currency: string;
  status_code: string;
  md5sig: string;
  [key: string]: string | undefined;
};

const notifySig = (cfg: PayHereConfig, p: PayHereNotify) =>
  md5(p.merchant_id + p.order_id + p.payhere_amount + p.payhere_currency + p.status_code + md5(cfg.secret));

/** True only for a notify signed with this merchant's secret. */
export function verifyNotify(cfg: PayHereConfig, p: PayHereNotify): boolean {
  if (p.merchant_id !== cfg.merchantId) return false;
  const want = Buffer.from(notifySig(cfg, p));
  const got = Buffer.from(String(p.md5sig ?? '').toUpperCase());
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Signs a notify the way PayHere does: for the mock gateway and tests. */
export function signNotify(cfg: PayHereConfig, p: Omit<PayHereNotify, 'md5sig'>): PayHereNotify {
  const unsigned = { ...p, md5sig: '' } as PayHereNotify;
  return { ...unsigned, md5sig: notifySig(cfg, unsigned) };
}

export type PayHereOutcome = 'PAID' | 'PENDING' | 'CANCELLED' | 'FAILED' | 'CHARGEDBACK';

const OUTCOMES: Record<string, PayHereOutcome> = {
  '2': 'PAID',
  '0': 'PENDING',
  '-1': 'CANCELLED',
  '-2': 'FAILED',
  '-3': 'CHARGEDBACK',
};

export const outcomeOf = (statusCode: string): PayHereOutcome | null => OUTCOMES[statusCode] ?? null;
