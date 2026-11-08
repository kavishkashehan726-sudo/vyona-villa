import { NextResponse } from 'next/server';
import { MAINTENANCE_MESSAGE, maintenanceOn, maintenancePage } from '@/lib/maintenance';

// Maintenance mode: while the owner has it on, every page answers 503 with the maintenance
// page (search engines keep the site's listing and come back later) and the API answers 503.
// Left out by the matcher: photos and built assets, the health check (deploys and the
// watchdog), and the PayHere notify and Beds24 webhook, so payments and Booking.com
// bookings already on their way still land.
const HEADERS = { 'Retry-After': '1800', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export async function proxy(req: Request) {
  if (!(await maintenanceOn())) return NextResponse.next();
  if (new URL(req.url).pathname.startsWith('/api/')) {
    return NextResponse.json({ error: MAINTENANCE_MESSAGE }, { status: 503, headers: HEADERS });
  }
  return new NextResponse(await maintenancePage(), {
    status: 503,
    headers: { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export const config = {
  matcher: [
    '/((?!_next/|media/|api/health|api/payhere/notify|api/webhooks/|icon|apple-icon|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)',
  ],
};
