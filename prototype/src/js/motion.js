// Deep Parallax 2.0 + scroll reveals (frontend guide §2).
// Layers move at different speeds; everything is translate3d/scale/opacity.
// Reveals use transform masks rather than clip-path so they stay on the compositor.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$ } from './ui.js';

gsap.registerPlugin(ScrollTrigger);

function reveals(reduced) {
  const els = $$('.reveal, .unveil');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  els.forEach((el) => io.observe(el));

  // Stagger siblings in grids so cards arrive one after another.
  $$('[data-rooms] .reveal, [data-gallery] .reveal').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 7) * 70}ms`;
  });
}

function parallax() {
  const hero = $('.hero');

  // Hero: photo drifts slowest, palms/lines faster, text slides against them.
  gsap.to('[data-hero-media]', {
    yPercent: 12,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
  $$('[data-depth]', hero).forEach((el) => {
    const depth = Number(el.dataset.depth);
    gsap.to(el, {
      y: () => depth * window.innerHeight * 0.5,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    });
  });

  // Experience tiles: each image at its own speed inside its frame.
  $$('[data-parallax]').forEach((el) => {
    const f = Number(el.dataset.parallax) * 60;
    gsap.fromTo(
      el,
      { yPercent: -f },
      {
        yPercent: f,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  });

  // Statement: the guide's exact recipe, y -20% -> 15%, scale 1.15 -> 1, scrubbed.
  const st = $('[data-statement]');
  gsap.fromTo(
    '[data-statement-img]',
    { yPercent: -20, scale: 1.15 },
    {
      yPercent: 15,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: st, start: 'top bottom', end: 'bottom top', scrub: true },
    }
  );

  // Palm shadow in the CTA band sways slightly as it passes.
  gsap.fromTo('.cta__palm', { y: -30, rotate: 146 }, {
    y: 30,
    rotate: 154,
    ease: 'none',
    scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // Images finish decoding after first layout; re-measure once they settle.
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

export function initMotion(cap) {
  reveals(cap.reduced);
  if (!cap.reduced) parallax();
}
