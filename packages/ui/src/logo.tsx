// The redrawn VYONA mark from brand/. The official logo file hasn't arrived;
// when it does, this is the only file to change.

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
