// What a server action hands back to the form that called it.

import { AdminError } from '@vyona/core';

export type Result = { ok: boolean; message: string; at?: number } | null;

export const ok = (message: string): Result => ({ ok: true, message, at: Date.now() });
export const fail = (message: string): Result => ({ ok: false, message, at: Date.now() });

/** Runs an action, turning the owner's mistakes into messages and anything else into a generic one. */
export async function attempt(run: () => Promise<Result>): Promise<Result> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof AdminError) return fail(err.message);
    // redirect() and notFound() work by throwing; let them through.
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    console.error('[admin]', err);
    return fail('That didn’t save. Try again; if it keeps failing, check the server logs.');
  }
}

export const text = (fd: FormData, name: string, max = 500) => String(fd.get(name) ?? '').trim().slice(0, max);

/** Dollars typed by the owner ("65", "65.50", "$1,200") → cents, or null if blank/invalid. */
export function cents(value: string): number | null {
  const v = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  return Math.round(Number(v) * 100);
}

export function int(value: string): number | null {
  return /^-?\d+$/.test(value.trim()) ? Number(value) : null;
}
