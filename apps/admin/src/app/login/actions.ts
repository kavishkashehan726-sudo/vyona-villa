'use server';

import { checkLogin, createSession, endSession } from '@vyona/core';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { fail, text, type Result } from '@/lib/actions';
import { clearSessionCookie, getToken, setSessionCookie } from '@/lib/session';
import { clearFailures, lockedFor, recordFailure } from '@/lib/throttle';

/** Only paths on this site: "/x" yes, "//evil.com" and "https://…" no. */
const safeNext = (v: string) => (/^\/(?![/\\])/.test(v) ? v : '/');

export async function signIn(_prev: Result, fd: FormData): Promise<Result> {
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') ?? '').slice(0, 200);
  if (!email || !password) return fail('Enter your email and password.');

  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
  const keys = [`email:${email}`, `ip:${ip}`];
  const wait = lockedFor(keys);
  if (wait) return fail(`Too many attempts. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`);

  const admin = await checkLogin(email, password);
  if (!admin) {
    recordFailure(keys);
    return fail('That email and password don’t match.');
  }
  clearFailures(keys);
  const { token, expiresAt } = await createSession(admin.id);
  await setSessionCookie(token, expiresAt);
  redirect(safeNext(text(fd, 'next', 500)));
}

export async function signOut() {
  const token = await getToken();
  if (token) await endSession(token);
  await clearSessionCookie();
  redirect('/login');
}
