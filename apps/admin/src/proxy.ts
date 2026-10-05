import { NextResponse, type NextRequest } from 'next/server';

// A cheap first gate: no session cookie, no admin pages. Whether the cookie is
// valid is checked against the database by requireAdmin() on every page and action.
const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-vy_admin' : 'vy_admin';

export function proxy(req: NextRequest) {
  if (req.cookies.has(COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = '/login';
  url.search = next === '/' ? '' : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/health|_next/|favicon.ico|icon).*)'],
};
