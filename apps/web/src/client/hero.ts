// Cinematic hero: Ken Burns cross-fade over the client's photos.
// Only transform + opacity animate. When footage arrives, replace the
// slides with <video autoplay muted loop playsinline> and drop this loop.
// Subpage heroes have one slide and no dots: they get the intro only.

import { gsap } from 'gsap';
import type { Capability } from './capability';
import { loadNow } from './images';
import { $$ } from './ui';

const INTERVAL = 7000;

export function initHero(hero: HTMLElement, cap: Capability) {
  const slides = $$('.hero__slide', hero);
  const dotBtns = $$<HTMLButtonElement>('[data-hero-dots] button', hero);
  const ac = new AbortController();
  const { signal } = ac;
  let i = 0;
  let timer = 0;
  let visible = true;
  const fades = new Set<number>();

  const show = (n: number) => {
    const prev = slides[i];
    i = (n + slides.length) % slides.length;
    const cur = slides[i]!;
    loadNow(cur);
    const next = slides[(i + 1) % slides.length];
    if (next) loadNow(next);
    if (prev && prev !== cur) {
      prev.classList.remove('is-active');
      const t = window.setTimeout(() => {
        prev.classList.remove('kb');
        fades.delete(t);
      }, 1800);
      fades.add(t);
    }
    cur.classList.remove('kb');
    void cur.offsetWidth; // restart the Ken Burns keyframes
    if (!cap.reduced) cur.classList.add('kb');
    cur.classList.add('is-active');
    dotBtns.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
  };

  const play = () => {
    clearInterval(timer);
    if (cap.reduced || !visible || document.hidden || slides.length < 2) return;
    timer = window.setInterval(() => show(i + 1), INTERVAL);
  };

  dotBtns.forEach((d, k) =>
    d.addEventListener(
      'click',
      () => {
        show(k);
        play();
      },
      { signal },
    ),
  );
  document.addEventListener('visibilitychange', play, { signal });
  let io: IntersectionObserver | null = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true;
      play();
    });
    io.observe(hero);
  }

  if (slides.length) show(0);
  play();

  let tl: gsap.core.Timeline | null = null;
  if (!cap.reduced) {
    // Page-load sequence: the headline rises out of its line masks.
    const q = gsap.utils.selector(hero);
    const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
    tl = intro;
    // Page heroes have no script, rail or dots; skip steps with nothing to animate.
    const from = (sel: string, vars: gsap.TweenVars, at?: string) => {
      const els = q(sel);
      if (els.length) intro.from(els, vars, at);
    };
    from('.hero__title .line > span', { yPercent: 110, duration: 1.5, stagger: 0.12 });
    from('.hero__content .rule', { scaleX: 0, transformOrigin: 'left', duration: 1.2 }, '-=1.1');
    from('.hero__lede, .hero__content .btn', { opacity: 0, y: 18, duration: 1.2, stagger: 0.1 }, '-=1');
    from('.hero__script', { opacity: 0, y: -12, rotate: -9, duration: 1.6 }, '-=1.2');
    from('.hero__rail', { opacity: 0, x: 20, duration: 1.4 }, '-=1.4');
    from('.hero__dots, .hero__scroll', { opacity: 0, duration: 1 }, '-=1');
  }

  return () => {
    ac.abort();
    io?.disconnect();
    clearInterval(timer);
    fades.forEach(clearTimeout);
    tl?.revert();
  };
}
