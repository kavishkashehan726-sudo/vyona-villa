// Display currency, shared by React (useCurrency) and the booking widget.
// Prices are stored in USD cents; LKR uses the rate from Settings.

import { boot } from './boot';

export type Currency = 'USD' | 'LKR';

const listeners = new Set<() => void>();
let currency: Currency | null = null;

export function getCurrency(): Currency {
  if (currency) return currency;
  currency = 'USD';
  try {
    if (localStorage.getItem('vy-currency') === 'LKR') currency = 'LKR';
  } catch {
    /* storage unavailable */
  }
  return currency;
}

export const getServerCurrency = (): Currency => 'USD';

export function setCurrency(next: Currency) {
  if (next === getCurrency()) return;
  currency = next;
  try {
    localStorage.setItem('vy-currency', next);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn());
}

export function onCurrency(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Pure formatter, safe on the server. */
export function formatMoney(cents: number, cur: Currency, lkrPerUsd: number, { compact = false } = {}) {
  if (cur === 'LKR') {
    const v = Math.round(((cents / 100) * lkrPerUsd) / 100) * 100;
    if (compact && v >= 10000) return `Rs ${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`;
    return `LKR ${v.toLocaleString('en-US')}`;
  }
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}

/** Browser-only: formats in the visitor's chosen currency. */
export const money = (cents: number, opts?: { compact?: boolean }) =>
  formatMoney(cents, getCurrency(), boot().settings.lkrPerUsd, opts);
