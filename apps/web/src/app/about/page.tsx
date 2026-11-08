import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageEffects } from '@/components/PageEffects';
import { Cta } from '@/components/sections/Cta';
import { PageHero } from '@/components/sections/Hero';
import { Story } from '@/components/sections/Story';
import { ABOUT, SHOW_DRAFT_PAGES } from '@/lib/content';
import { pageMeta } from '@/lib/seo';

export const generateMetadata = (): Promise<Metadata> =>
  pageMeta({
    title: 'About',
    description:
      'How VYONA began, the people who host it, the kitchen and the Weligama community around it.',
    path: '/about',
    photo: 'door-statue',
  });

export default function AboutPage() {
  if (!SHOW_DRAFT_PAGES) notFound();
  return (
    <>
      <PageHero photo="door-statue" eyebrow="About" lines={['A home first.', 'A villa second.']} />
      <Story blocks={ABOUT} note="Placeholder structure. The story, host photos and copy are to come from the client." />
      <Cta />
      <PageEffects />
    </>
  );
}
