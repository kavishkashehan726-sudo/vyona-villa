// Tiny shared state: display currency. Prices are stored in USD.
// LKR uses a fixed placeholder rate until the real rate source is decided.

export const LKR_PER_USD = 300;

const listeners = new Set();
let currency = 'USD';
try {
  if (localStorage.getItem('vy-currency') === 'LKR') currency = 'LKR';
} catch {
  /* storage unavailable */
}

export const getCurrency = () => currency;

export function setCurrency(next) {
  if (next === currency) return;
  currency = next;
  try {
    localStorage.setItem('vy-currency', next);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(currency));
}

export const onCurrency = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function money(usd, { compact = false } = {}) {
  if (currency === 'LKR') {
    const v = Math.round((usd * LKR_PER_USD) / 100) * 100;
    if (compact && v >= 10000) return `Rs ${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`;
    return `LKR ${v.toLocaleString('en-US')}`;
  }
  return `$${Math.round(usd).toLocaleString('en-US')}`;
}
