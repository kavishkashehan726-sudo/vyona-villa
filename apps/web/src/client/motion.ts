// Deep Parallax 2.0 + scroll reveals (frontend guide §2).
// Layers move at different speeds; everything is translate3d/scale/opacity.
// Reveals use transform masks rather than clip-path so they stay on the compositor.
// Scoped to one page's <main> and reverted when the page unmounts.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Capability } from './capability';
import { $, $$ } from './ui';

gsap.registerPlugin(ScrollTrigger);

function reveals(root: HTMLElement, reduced: boolean) {
  const els = $$('.reveal, .unveil', root);
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));

  // Stagger siblings in grids so cards arrive one after another.
  $$('[data-rooms] .reveal, [data-gallery] .reveal', root).forEach((el, i) => {
    el.style.transitionDelay = `${(i % 7) * 70}ms`;
  });
  return () => io.disconnect();
}

function parallax(root: HTMLElement) {
  const hero = $('.hero', root);
  if (hero) {
    // Hero: photo drifts slowest, palms/lines faster, text slides against them.
    const scrub = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    gsap.to($$('[data-hero-media]', hero), { yPercent: 12, ease: 'none', scrollTrigger: scrub });
    $$('[data-depth]', hero).forEach((el) => {
      const depth = Number(el.dataset.depth);
      gsap.to(el, {
        y: () => depth * window.innerHeight * 0.5,
        ease: 'none',
        scrollTrigger: { ...scrub, invalidateOnRefresh: true },
      });
    });
  }

  // Pillar, "a little more" and story images: each at its own speed inside its frame.
  $$('[data-parallax]', root).forEach((el) => {
    const f = Number(el.dataset.parallax) * 60;
    gsap.fromTo(
      el,
      { yPercent: -f },
      {
        yPercent: f,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });

  // Statement: the guide's exact recipe, y -20% -> 15%, scale 1.15 -> 1, scrubbed.
  const st = $('[data-statement]', root);
  const stImg = st && $('[data-statement-img]', st);
  if (st && stImg) {
    gsap.fromTo(
      stImg,
      { yPercent: -20, scale: 1.15 },
      {
        yPercent: 15,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: st, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  }

  // Palm shadows in the CTA band and "a little more" sway slightly as they pass.
  $$('.cta__palm, .more__palm', root).forEach((palm) => {
    const base = palm.classList.contains('cta__palm') ? 150 : 30;
    gsap.fromTo(
      palm,
      { y: -30, rotate: base - 4 },
      {
        y: 30,
        rotate: base + 4,
        ease: 'none',
        scrollTrigger: { trigger: palm.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

export function initMotion(root: HTMLElement, cap: Capability) {
  const stopReveals = reveals(root, cap.reduced);
  if (cap.reduced) return stopReveals;

  const ctx = gsap.context(() => parallax(root), root);
  // Images finish decoding after first layout; re-measure once they settle.
  const refresh = () => ScrollTrigger.refresh();
  if (document.readyState === 'complete') requestAnimationFrame(refresh);
  else window.addEventListener('load', refresh, { once: true });

  return () => {
    stopReveals();
    window.removeEventListener('load', refresh);
    ctx.revert();
  };
}
