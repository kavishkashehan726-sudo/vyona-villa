import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cormorant, jost, script } from './fonts';
import './globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vyonaweligama.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'VYONA Weligama · Seven rooms on the south coast', template: '%s · VYONA Weligama' },
  description:
    'A seven-room boutique villa among the palms, just beyond the bustle of Weligama, Sri Lanka. Pool, gardens and breakfast made here.',
  // Kept out of search engines until the client confirms real prices.
  robots: process.env.NEXT_PUBLIC_INDEXABLE === '1' ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#f1ece3' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
