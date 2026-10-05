'use client';

// Site-wide behaviour that lives for the whole visit: capability classes,
// blur-up loading, the booking drawer, cursor, magnetic buttons and ripple.
// Page-specific effects are in PageEffects.

import { useEffect } from 'react';
import { initBooking } from '@/client/booking';
import { getCap } from '@/client/capability';
import { initCursor } from '@/client/cursor';
import { watchImages } from '@/client/images';
import { initMagnetic } from '@/client/magnetic';
import { initRipple } from '@/client/ripple';
import { initBadge } from '@/client/ui';

let started = false;

export function Runtime() {
  useEffect(() => {
    if (started) return;
    started = true;
    const cap = getCap();
    const html = document.documentElement;
    html.classList.toggle('is-lite', cap.low);
    html.classList.toggle('is-reduced', cap.reduced);
    watchImages();
    initBadge();
    initBooking();
    if (cap.cursor) {
      initCursor();
      initMagnetic();
    }
    if (cap.ripple) initRipple();
  }, []);
  return null;
}
