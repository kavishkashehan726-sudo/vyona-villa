import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@vyona/ui';
import { PageEffects } from '@/components/PageEffects';
import { Cta } from '@/components/sections/Cta';
import { PageHero } from '@/components/sections/Hero';
import { Story } from '@/components/sections/Story';
import { PILLARS, pillarBySlug, SHOW_DRAFT_PAGES } from '@/lib/content';

export function generateStaticParams() {
  return SHOW_DRAFT_PAGES ? PILLARS.map((p) => ({ pillar: p.slug })) : [];
}

export async function generateMetadata({ params }: PageProps<'/explore/[pillar]'>): Promise<Metadata> {
  const p = pillarBySlug((await params).pillar);
  if (!p) return {};
  return { title: p.title, description: `${p.tag} ${p.body}`, alternates: { canonical: `/explore/${p.slug}` } };
}

export default async function PillarPage({ params }: PageProps<'/explore/[pillar]'>) {
  const p = pillarBySlug((await params).pillar);
  if (!p || !SHOW_DRAFT_PAGES) notFound();
  const others = PILLARS.filter((o) => o.slug !== p.slug);

  return (
    <>
      <PageHero photo={p.photo} eyebrow="Explore" lines={[p.title]} lede={p.tag} />
      <Story blocks={p.story} note="Draft copy until the client sends theirs." />
      <nav className="pillar-nav" aria-label="More to explore">
        {others.map((o) => (
          <Link className="link-caps" href={`/explore/${o.slug}`} key={o.slug}>
            {o.title} <Icon name="arrow" className="i" />
          </Link>
        ))}
      </nav>
      <Cta />
      <PageEffects />
    </>
  );
}
