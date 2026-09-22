// Cinematic hero: Ken Burns cross-fade over the client's photos.
// Only transform + opacity animate. When footage arrives, replace the
// slides with <video autoplay muted loop playsinline> and drop this loop.

import { gsap } from 'gsap';
import { loadNow } from './images.js';
import { $, $$ } from './ui.js';

const INTERVAL = 7000;

export function initHero(cap) {
  const slides = $$('.hero__slide');
  const dots = $('[data-hero-dots]');
  let i = 0;
  let timer = 0;
  let visible = true;

  dots.innerHTML = slides
    .map((_, n) => `<button role="tab" aria-label="Photo ${n + 1} of ${slides.length}" aria-selected="${n === 0}"></button>`)
    .join('');
  const dotBtns = $$('button', dots);

  const show = (n) => {
    const prev = slides[i];
    i = (n + slides.length) % slides.length;
    const cur = slides[i];
    loadNow(cur);
    loadNow(slides[(i + 1) % slides.length]);
    if (prev !== cur) {
      prev.classList.remove('is-active');
      setTimeout(() => prev.classList.remove('kb'), 1800);
    }
    cur.classList.remove('kb');
    void cur.offsetWidth; // restart the Ken Burns keyframes
    if (!cap.reduced) cur.classList.add('kb');
    cur.classList.add('is-active');
    dotBtns.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
  };

  const play = () => {
    clearInterval(timer);
    if (cap.reduced || !visible || document.hidden) return;
    timer = setInterval(() => show(i + 1), INTERVAL);
  };

  dotBtns.forEach((d, k) =>
    d.addEventListener('click', () => {
      show(k);
      play();
    })
  );
  document.addEventListener('visibilitychange', play);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      play();
    }).observe($('.hero'));
  }

  show(0);
  play();

  if (cap.reduced) return;
  // Page-load sequence: the headline rises out of its line masks.
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
  tl.from('.hero__title .line > span', { yPercent: 110, duration: 1.5, stagger: 0.12 })
    .from('.hero__content .rule', { scaleX: 0, transformOrigin: 'left', duration: 1.2 }, '-=1.1')
    .from('.hero__lede, .hero__content .btn', { opacity: 0, y: 18, duration: 1.2, stagger: 0.1 }, '-=1')
    .from('.hero__rail', { opacity: 0, x: 20, duration: 1.4 }, '-=1.2')
    .from('.hero__dots, .hero__scroll', { opacity: 0, duration: 1 }, '-=1');
}
