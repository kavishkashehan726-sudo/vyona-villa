'use client';

import { useRouter } from 'next/navigation';

/** Jumps the calendar to a date. */
export function JumpTo({ value }: { value: string }) {
  const router = useRouter();
  return (
    <label className="jump">
      <span className="sr-only">Go to date</span>
      <input
        className="input input--sm"
        type="date"
        defaultValue={value}
        key={value}
        onChange={(e) => e.target.value && router.push(`/?date=${e.target.value}`)}
      />
    </label>
  );
}
