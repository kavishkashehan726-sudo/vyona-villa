import type { Metadata } from 'next';
import { Jost } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const jost = Jost({ subsets: ['latin'], weight: ['300', '400', '500'], variable: '--font-jost' });

export const metadata: Metadata = {
  title: { default: 'VYONA Admin', template: '%s · VYONA Admin' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
