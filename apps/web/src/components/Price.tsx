'use client';

// A price in the visitor's currency. Renders USD on the server and switches
// after hydration if they picked LKR.

import { useSyncExternalStore } from 'react';
import { boot } from '@/client/boot';
import { formatMoney, getCurrency, getServerCurrency, onCurrency } from '@/client/store';

export function Price({ cents, exact = false }: { cents: number; exact?: boolean }) {
  const cur = useSyncExternalStore(onCurrency, getCurrency, getServerCurrency);
  return <>{formatMoney(cents, cur, cur === 'LKR' ? boot().settings.lkrPerUsd : 0, { exact })}</>;
}
