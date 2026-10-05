'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Reloads the page's data after a moment, for work the worker finishes just after the page was drawn. */
export function RefreshSoon({ ms = 3000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.refresh(), ms);
    return () => clearTimeout(t);
  }, [router, ms]);
  return null;
}
