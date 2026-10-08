'use client';

// STAY · EXPLORE · ABOUT | logo | GALLERY · CONTACT · Book your stay.
// Turns translucent once scrolled, hides while scrolling down past the hero
// and comes back on the way up. Below 900px the links move into a full-screen menu.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Logo } from '@vyona/ui';
import { lockScroll } from '@/client/ui';
import { ABOUT_HREF } from '@/lib/content';
import { SHOW_VILLA_3D } from '@/lib/villa';

const LEFT = [
  ['/stay', 'Stay'],
  ['/explore', 'Explore'],
  [ABOUT_HREF, 'About'],
] as const;
const RIGHT = [
  ['/gallery', 'Gallery'],
  ['/contact', 'Contact'],
] as const;
const MENU = [...LEFT, ...(SHOW_VILLA_3D ? [['/#villa3d', 'The villa in 3D'] as const] : []), ...RIGHT];

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? 'page' : undefined);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      setScrolled(y > 30);
      setHidden(y > lastY && y > window.innerHeight * 0.9 && !openRef.current);
      lastY = y;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    lockScroll(true);
    menu.current?.querySelector('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggle.current?.focus();
    };
    const wide = window.matchMedia('(min-width: 901px)');
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    wide.addEventListener('change', onWide);
    return () => {
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      wide.removeEventListener('change', onWide);
    };
  }, [open]);

  const closeOnPick = (e: MouseEvent) => {
    if ((e.target as Element).closest('a, button')) setOpen(false);
  };

  const links = (items: readonly (readonly [string, string])[]) =>
    items.map(([href, label]) => (
      <li key={href}>
        <Link href={href} aria-current={current(href)}>
          {label}
        </Link>
      </li>
    ));

  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}${hidden ? ' is-hidden' : ''}`}>
      <nav className="nav__inner" aria-label="Main">
        <ul className="nav__links nav__links--left">{links(LEFT)}</ul>
        <Link className="brand" href="/" aria-label="VYONA, home">
          <Logo compact className="brand__logo" />
          <span className="brand__sub">Weligama · Sri Lanka</span>
        </Link>
        <ul className="nav__links nav__links--right">
          {links(RIGHT)}
          <li>
            <Link className="btn btn--olive btn--sm magnetic" href="/book" data-open-booking data-cursor="Book">
              Book your stay
            </Link>
          </li>
        </ul>
        <button
          ref={toggle}
          type="button"
          className="nav__toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <span className="nav__burger" aria-hidden="true" />
        </button>
      </nav>
      <div className="mobile-menu" id="mobile-menu" ref={menu} hidden={!open} onClick={closeOnPick}>
        <ul>
          {MENU.map(([href, label]) => (
            <li key={href}>
              <Link href={href} aria-current={current(href)}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <Link className="btn btn--olive" href="/book" data-open-booking>
          Book your stay
        </Link>
      </div>
    </header>
  );
}
