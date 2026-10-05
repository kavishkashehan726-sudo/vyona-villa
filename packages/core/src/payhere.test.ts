import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  checkoutFields,
  outcomeOf,
  payhereAmount,
  payhereConfig,
  signNotify,
  verifyCheckout,
  verifyNotify,
  type PayHereConfig,
} from './payhere';

const cfg: PayHereConfig = { merchantId: '1211149', secret: 'top-secret', checkoutUrl: 'x', mock: false };
const MD5 = (s: string) => createHash('md5').update(s).digest('hex').toUpperCase();

describe('payhereAmount', () => {
  it.each([
    [0, '0.00'],
    [5, '0.05'],
    [1005, '10.05'],
    [123450, '1234.50'],
    [10000000, '100000.00'],
  ])('%i cents → %s', (cents, out) => expect(payhereAmount(cents)).toBe(out));

  it('rejects fractions and negatives', () => {
    expect(() => payhereAmount(1.5)).toThrow();
    expect(() => payhereAmount(-1)).toThrow();
  });
});

describe('checkoutFields', () => {
  const fields = checkoutFields(cfg, {
    orderId: 'VY-ABCDE-1',
    amount: 21450,
    currency: 'USD',
    items: 'Dhara · 3 nights',
    guest: { name: '  Ana  de la Cruz ', email: 'ana@example.com', phone: '+94 77 123 4567' },
    returnUrl: 'https://vyona.test/book/VY-ABCDE?payment=done',
    cancelUrl: 'https://vyona.test/book/VY-ABCDE?payment=cancelled',
    notifyUrl: 'https://vyona.test/api/payhere/notify',
  });

  it('signs merchant, order, amount and currency with the hashed secret', () => {
    expect(fields.amount).toBe('214.50');
    expect(fields.hash).toBe(MD5('1211149' + 'VY-ABCDE-1' + '214.50' + 'USD' + MD5('top-secret')));
  });

  it('verifies its own hash and nothing else', () => {
    expect(verifyCheckout(cfg, fields)).toBe(true);
    expect(verifyCheckout(cfg, { ...fields, amount: '1.00' })).toBe(false);
    expect(verifyCheckout({ ...cfg, secret: 'other' }, fields)).toBe(false);
  });

  it('splits the name and fills the fields PayHere requires', () => {
    expect(fields.first_name).toBe('Ana');
    expect(fields.last_name).toBe('de la Cruz');
    expect(fields.country).toBe('Sri Lanka');
    for (const k of ['merchant_id', 'return_url', 'cancel_url', 'notify_url', 'phone', 'address', 'city', 'items']) {
      expect(fields[k], k).toBeTruthy();
    }
  });
});

describe('verifyNotify', () => {
  const base = {
    merchant_id: '1211149',
    order_id: 'VY-ABCDE-1',
    payment_id: '320025071278',
    payhere_amount: '214.50',
    payhere_currency: 'USD',
    status_code: '2',
  };

  it('accepts a notify signed with the secret', () => {
    const p = signNotify(cfg, base);
    expect(p.md5sig).toBe(MD5('1211149VY-ABCDE-1214.50USD2' + MD5('top-secret')));
    expect(verifyNotify(cfg, p)).toBe(true);
    expect(verifyNotify(cfg, { ...p, md5sig: p.md5sig.toLowerCase() })).toBe(true);
  });

  it.each([
    ['a forged signature', { md5sig: 'F'.repeat(32) }],
    ['a changed amount', { payhere_amount: '1.00' }],
    ['a changed status', { status_code: '-2' }],
    ['another merchant', { merchant_id: '9999999' }],
    ['no signature', { md5sig: '' }],
  ])('rejects %s', (_, change) => {
    expect(verifyNotify(cfg, { ...signNotify(cfg, base), ...change })).toBe(false);
  });

  it('rejects a notify signed with another secret', () => {
    expect(verifyNotify(cfg, signNotify({ ...cfg, secret: 'guess' }, base))).toBe(false);
  });
});

describe('payhereConfig', () => {
  it('uses the sandbox unless told otherwise', () => {
    const env = { PAYHERE_MERCHANT_ID: '1', PAYHERE_MERCHANT_SECRET: 's' };
    expect(payhereConfig(env)?.checkoutUrl).toContain('sandbox.payhere.lk');
    expect(payhereConfig({ ...env, PAYHERE_SANDBOX: '0' })?.checkoutUrl).toBe('https://www.payhere.lk/pay/checkout');
  });

  it('falls back to the mock in development and to nothing in production', () => {
    expect(payhereConfig({ NODE_ENV: 'development' })?.mock).toBe(true);
    expect(payhereConfig({ NODE_ENV: 'production' })).toBeNull();
  });
});

it('maps status codes', () => {
  expect(['2', '0', '-1', '-2', '-3', '7'].map(outcomeOf)).toEqual(['PAID', 'PENDING', 'CANCELLED', 'FAILED', 'CHARGEDBACK', null]);
});
