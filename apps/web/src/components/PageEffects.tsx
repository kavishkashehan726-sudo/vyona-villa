'use client';

// Per-page effects, bound to the server-rendered markup of the page it sits
// in and torn down when that page unmounts: hero, parallax and reveals,
// gallery, map and the 3D villa (loaded only on pages that have it).

import { useEffect } from 'react';
import { getCap } from '@/client/capability';
import { initGallery } from '@/client/gallery';
import { initHero } from '@/client/hero';
import { initMotion } from '@/client/motion';
import { initMap } from '@/client/ui';

export function PageEffects() {
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

    const villa = main.querySelector<HTMLElement>('[data-villa3d-section]');
    if (villa) {
      void import('@/client/villa3d').then(({ initVilla }) => {
        if (alive) stops.push(initVilla(villa, cap));
      });
    }

    return () => {
      alive = false;
      stops.forEach((stop) => stop());
    };
  }, []);
  return null;
}
