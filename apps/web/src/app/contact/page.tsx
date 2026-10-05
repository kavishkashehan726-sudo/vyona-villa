import type { Metadata } from 'next';
import { PageEffects } from '@/components/PageEffects';
import { Contact } from '@/components/sections/Contact';
import { Cta } from '@/components/sections/Cta';
import { PageHero } from '@/components/sections/Hero';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to reach VYONA in Weligama: WhatsApp, email, phone and directions.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <>
      <PageHero photo="hero-house" eyebrow="Contact" lines={['Find us', 'among the palms.']} />
      <Contact />
      <Cta />
      <PageEffects />
    </>
  );
}
