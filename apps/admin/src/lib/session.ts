// Who is signed in. Pages and server actions call requireAdmin(); proxy.ts only
// sends browsers without a cookie to /login, it doesn't trust the cookie.

import { sessionAdmin } from '@vyona/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

// __Host- cookies must be Secure, so the prefix is production only (dev is plain http).
export const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-vy_admin' : 'vy_admin';

export const getToken = async () => (await cookies()).get(COOKIE)?.value;

export const getAdmin = cache(async () => sessionAdmin(await getToken()));

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect('/login');
  return admin;
}

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}
