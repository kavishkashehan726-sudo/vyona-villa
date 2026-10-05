'use client';

// Mobile sticky booking bar: shows once the hero has scrolled away and hides
// again over the page's own booking section.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Price } from './Price';

export function BookBar({ from }: { from: number }) {
  const path = usePathname();
  const [on, setOn] = useState(false);

  useEffect(() => {
    const targets = ['#main .hero', '#booking'].flatMap((s) => [...document.querySelectorAll(s)]);
    if (!targets.length || !('IntersectionObserver' in window)) {
      const raf = requestAnimationFrame(() => setOn(true));
      return () => cancelAnimationFrame(raf);
    }
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => seen.set(e.target, e.isIntersecting));
      setOn(![...seen.values()].some(Boolean));
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [path]);

  return (
    <div className={on ? 'book-bar is-on' : 'book-bar'} aria-hidden={!on} inert={!on}>
      <p>
        <span className="book-bar__from">From</span>{' '}
        <strong>
          <Price cents={from} />
        </strong>{' '}
        <span>/ night</span>
      </p>
      <Link className="btn btn--olive btn--sm" href="/book" data-open-booking>
        Check dates
      </Link>
    </div>
  );
}
