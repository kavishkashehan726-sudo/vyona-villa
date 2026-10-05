import type { Metadata } from 'next';
import { PageEffects } from '@/components/PageEffects';
import { Cta } from '@/components/sections/Cta';
import { PageHero } from '@/components/sections/Hero';
import { Story } from '@/components/sections/Story';
import { ABOUT } from '@/lib/content';

export const metadata: Metadata = {
  title: 'About',
  description: 'How VYONA began, the people who host it, the kitchen and the Weligama community around it.',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <PageHero photo="door-statue" eyebrow="About" lines={['A home first.', 'A villa second.']} />
      <Story blocks={ABOUT} note="Placeholder structure. The story, host photos and copy are to come from the client." />
      <Cta />
      <PageEffects />
    </>
  );
}
