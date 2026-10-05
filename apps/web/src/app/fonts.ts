import { Cormorant_Garamond, Jost, Mrs_Saint_Delafield } from 'next/font/google';

// Display face. The hero is set in the italic.
export const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

// Uppercase, letter-spaced labels and UI.
export const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jost',
  display: 'swap',
});

// The handwritten "Weligama / Sri Lanka" in the hero, from the client's reference.
export const script = Mrs_Saint_Delafield({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-script-face',
  display: 'swap',
});
