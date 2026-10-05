import type { Metadata } from 'next';
import { PageEffects } from '@/components/PageEffects';
import { Cta } from '@/components/sections/Cta';
import { Explore } from '@/components/sections/Explore';
import { PageHero } from '@/components/sections/Hero';

export const metadata: Metadata = {
  title: 'Explore',
  description: 'The villa, the food made here, and the South Coast beyond: what to do at VYONA and around Weligama.',
  alternates: { canonical: '/explore' },
};

export default function ExplorePage() {
  return (
    <>
      <PageHero photo="pool-swimmer" eyebrow="Explore" lines={['Stay in.', 'Or wander out.']} />
      <Explore />
      <Cta />
      <PageEffects />
    </>
  );
}
