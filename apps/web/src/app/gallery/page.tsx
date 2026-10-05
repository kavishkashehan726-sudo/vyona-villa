import type { Metadata } from 'next';
import { PageEffects } from '@/components/PageEffects';
import { Gallery } from '@/components/sections/Gallery';
import { PageHero } from '@/components/sections/Hero';

export const metadata: Metadata = {
  title: 'Gallery',
  description: 'Photos of VYONA: the rooms, the pool, the garden and breakfast in Weligama.',
  alternates: { canonical: '/gallery' },
};

export default function GalleryPage() {
  return (
    <>
      <PageHero photo="hero-pool-aerial" eyebrow="Gallery" lines={['Moments', 'at VYONA.']} />
      <Gallery title="Every corner." />
      <PageEffects />
    </>
  );
}
