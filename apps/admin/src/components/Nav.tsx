'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Calendar' },
  { href: '/reservations', label: 'Bookings' },
  { href: '/rates', label: 'Rates' },
  { href: '/photos', label: 'Photos' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="rail__nav" aria-label="Admin">
      {LINKS.map(({ href, label }) => {
        const here = href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={here ? 'page' : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
