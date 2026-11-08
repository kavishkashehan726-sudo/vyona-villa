import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { externalBookingUrl } from '@vyona/core';
import { Icon } from '@vyona/ui';
import { BookBar } from '@/components/BookBar';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { RoomDialog } from '@/components/RoomDialog';
import { Runtime } from '@/components/Runtime';
import type { BootData } from '@/client/boot';
import { clientPhotos, getPhotos } from '@/lib/media';
import { getContact, getRooms, getSettings, indexable, jsonScript, lodgingJsonLd, lowestRate, SITE_URL } from '@/lib/site';
import { HOME_DESCRIPTION, HOME_TITLE, SITE_NAME } from '@/lib/seo';
import { cormorant, jost } from './fonts';
import './globals.css';
import './site.css';

// Every page reads rooms, prices and photos from the database.
export const dynamic = 'force-dynamic';

// Read per request (not NEXT_PUBLIC_ variables, which the build would bake in), so indexing
// and the Search Console tag change with the server's .env and a restart, no new build.
export async function generateMetadata(): Promise<Metadata> {
  const google = process.env.GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: HOME_TITLE, template: `%s · ${SITE_NAME}` },
    description: HOME_DESCRIPTION,
    applicationName: SITE_NAME,
    // Kept out of search engines until SITE_INDEXABLE=1.
    robots: indexable() ? { index: true, follow: true } : { index: false, follow: false },
    ...(google && { verification: { google } }),
  };
}

export const viewport: Viewport = { themeColor: '#f1ece3' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [rooms, settings, photos, contact] = await Promise.all([getRooms(), getSettings(), getPhotos(), getContact()]);
  const bootData: BootData = {
    photos: clientPhotos(photos),
    rooms: rooms.map((r) => ({
      slug: r.slug,
      number: r.number,
      name: r.name,
      element: r.element,
      maxGuests: r.maxGuests,
      baseRate: r.baseRate,
      photo: r.photos[0] ?? '',
    })),
    settings,
    bookingUrl: externalBookingUrl(settings),
  };

  return (
    // The inline script adds `js` before first paint, so reveals start hidden.
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="cursor" aria-hidden="true">
          <span className="cursor__dot" />
          <span className="cursor__ring">
            <span className="cursor__label" />
          </span>
        </div>

        <Nav />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <Footer social={contact.social} />
        <BookBar from={lowestRate(rooms)} />

        {/* Booking drawer (mobile) / dialog (desktop); client/booking.ts moves the widget in. */}
        <div className="drawer" data-drawer hidden>
          <div className="drawer__scrim" data-drawer-close />
          <div className="drawer__sheet" role="dialog" aria-modal="true" aria-label="Book your stay" tabIndex={-1}>
            <div className="drawer__grip" aria-hidden="true" />
            <button type="button" className="icon-btn drawer__close" data-drawer-close aria-label="Close booking">
              <Icon name="close" className="i" />
            </button>
            <div className="drawer__body" data-drawer-body />
          </div>
        </div>

        <RoomDialog rooms={rooms} />
        <div className="toast" role="status" aria-live="polite" data-toast />

        <JsonLd data={lodgingJsonLd(rooms, settings, contact, photos)} />
        <script type="application/json" id="vy-boot" dangerouslySetInnerHTML={{ __html: jsonScript(bootData) }} />
        <Runtime />
      </body>
    </html>
  );
}
