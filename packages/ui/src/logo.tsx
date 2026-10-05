// The redrawn VYONA mark from brand/. The official logo file hasn't arrived;
// when it does, this is the only file to change.

import type { SVGProps } from 'react';

type Props = { className?: string; title?: string };

export function Mark({ className, title }: Props) {
  return (
    <svg
      viewBox="0 0 100 72"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <circle cx="50" cy="5" r="3.2" fill="currentColor" stroke="none" />
      <path d="M19 45 A 34 34 0 0 1 81 45" strokeWidth="2.2" />
      <path d="M50 16 C 58.5 29, 58.5 52, 50 67 C 41.5 52, 41.5 29, 50 16 Z" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M50 25 C 46.2 36, 46.2 49, 50 59" strokeWidth="1.2" />
    </svg>
  );
}

export function Logo({ className, title = 'VYONA, Weligama, Sri Lanka' }: Props) {
  return (
    <span className={className} role="img" aria-label={title}>
      <Mark className="mx-auto block h-[0.9em] w-auto" />
      <span aria-hidden="true" className="mt-[0.15em] block font-serif text-[1em] leading-none font-medium tracking-[0.28em]">
        VYONA
      </span>
      <span aria-hidden="true" className="mt-[0.4em] block font-sans text-[0.22em] leading-none tracking-[0.4em]">
        WELIGAMA · SRI LANKA
      </span>
    </span>
  );
}

// The palm-shadow overlay from the template (hero corners, CTA). Extra props
// carry the parallax hooks (data-depth).
export function Palm(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 400 400" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M200 400c6-80 10-150 30-220l6 2c-18 70-24 140-28 218Z" />
      <path d="M234 176c-40-30-110-40-190-10 60-8 120 0 186 16Z" />
      <path d="M236 172c-20-50-70-100-150-130 50 34 100 80 142 134Z" />
      <path d="M238 172c10-60 0-120-40-170 18 56 26 112 32 170Z" />
      <path d="M240 174c40-40 100-70 160-70-60 14-110 42-154 78Z" />
      <path d="M240 178c50-10 110 10 150 60-50-36-100-50-148-54Z" />
      <path d="M236 180c-30 20-70 60-90 120 30-50 60-86 94-114Z" />
    </svg>
  );
}
