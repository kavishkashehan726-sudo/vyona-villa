import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Icon } from '@vyona/ui';
import { BookBar } from '@/components/BookBar';
import { Footer } from '@/components/Footer';
import { JsonLd } from '@/components/JsonLd';
import { Nav } from '@/components/Nav';
import { RoomDialog } from '@/components/RoomDialog';
import { Runtime } from '@/components/Runtime';
import type { BootData } from '@/client/boot';
import { clientPhotos, getPhotos } from '@/lib/media';
import { getRooms, getSettings, indexable, jsonScript, lodgingJsonLd, lowestRate, SITE_URL } from '@/lib/site';
import { cormorant, jost, script } from './fonts';
import './globals.css';
import './site.css';

// Every page reads rooms, prices and photos from the database.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'VYONA Weligama · Seven rooms on the South Coast', template: '%s · VYONA Weligama' },
  description:
    'A seven-room boutique villa among the palms, just beyond the bustle of Weligama, Sri Lanka. Pool, gardens and breakfast made here.',
  openGraph: { type: 'website', siteName: 'VYONA Weligama', locale: 'en_GB' },
  // Kept out of search engines until the client confirms real prices. Read at run time (not a
  // NEXT_PUBLIC_ variable, which the build would bake in), so going live needs no new image.
  robots: indexable() ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#f1ece3' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [rooms, settings, photos] = await Promise.all([getRooms(), getSettings(), getPhotos()]);
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
  };

  return (
    // The inline script adds `js` before first paint, so reveals start hidden.
    <html lang="en" className={`${cormorant.variable} ${jost.variable} ${script.variable}`} suppressHydrationWarning>
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
        <Footer />
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

        <aside className="proto-badge" data-proto-badge>
          <p>
            <strong>Preview</strong>{' '}
            <span className="proto-badge__long">
              Prices and contact details are placeholders. Card payments go to a test gateway; nothing is charged.
            </span>
            <span className="proto-badge__short">Details are placeholders.</span>
          </p>
          <button type="button" className="icon-btn" data-proto-close aria-label="Hide preview notice">
            <Icon name="close" className="i" />
          </button>
        </aside>

        <JsonLd data={lodgingJsonLd(rooms, settings)} />
        <script type="application/json" id="vy-boot" dangerouslySetInnerHTML={{ __html: jsonScript(bootData) }} />
        <Runtime />
      </body>
    </html>
  );
}
