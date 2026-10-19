'use client';

// Per-page effects, bound to the server-rendered markup of the page it sits
// in and torn down when that page unmounts: hero, parallax and reveals,
// gallery, map and the 3D villa (loaded only on pages that have it).
// `scrollTo` names a section to bring into view on arrival (the contact page's details).

import { useEffect } from 'react';
import { pointBookLinks } from '@/client/booking';
import { getCap } from '@/client/capability';
import { initGallery } from '@/client/gallery';
import { initHero } from '@/client/hero';
import { initMotion } from '@/client/motion';
import { initMap, scrollToSection } from '@/client/ui';

export function PageEffects({ scrollTo }: { scrollTo?: string } = {}) {
  useEffect(() => {
    const main = document.getElementById('main');
    if (!main) return;
    const cap = getCap();
    const stops: (() => void)[] = [];
    let alive = true;

    const hero = main.querySelector<HTMLElement>('.hero');
    if (hero) stops.push(initHero(hero, cap));
    stops.push(initMotion(main, cap));
    main.querySelectorAll<HTMLElement>('[data-gallery-section]').forEach((s) => stops.push(initGallery(s)));
    main.querySelectorAll<HTMLElement>('[data-map]').forEach((m) => stops.push(initMap(m)));
    pointBookLinks(main);

    const villa = main.querySelector<HTMLElement>('[data-villa3d-section]');
    if (villa) {
      void import('@/client/villa3d').then(({ initVilla }) => {
        if (alive) stops.push(initVilla(villa, cap));
      });
    }

    // Only from the top of the page: a reload or Back keeps the visitor's own scroll position.
    const target = scrollTo ? document.getElementById(scrollTo) : null;
    let timer = 0;
    if (target && window.scrollY < 10 && !location.hash) {
      timer = window.setTimeout(() => {
        if (window.scrollY < 10) scrollToSection(target, !cap.reduced);
      }, 350);
    }

    return () => {
      alive = false;
      clearTimeout(timer);
      stops.forEach((stop) => stop());
    };
  }, [scrollTo]);
  return null;
}
