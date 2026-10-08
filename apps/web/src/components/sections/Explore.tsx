// VYONA / FOOD / BEYOND VYONA, the client's three columns. Each photo drifts
// at its own speed inside its frame and carries the ripple.

import Link from 'next/link';
import { Icon } from '@vyona/ui';
import { PILLARS, SHOW_DRAFT_PAGES, type Pillar } from '@/lib/content';
import { Photo } from '../Photo';

export function Explore({ only }: { only?: Pillar['slug'][] }) {
  const pillars = only ? PILLARS.filter((p) => only.includes(p.slug)) : PILLARS;
  return (
    <section className="explore" id="explore" aria-label="Explore">
      <div className="explore__grid">
        {pillars.map((p) => {
          const img = (
            <>
              <span data-parallax={p.depth}>
                <Photo k={p.photo} className="ripple" alt="" />
              </span>
              {p.slot && <span className="pillar__slot proto-note">{p.slot}</span>}
            </>
          );
          return (
          <article className="pillar reveal" key={p.slug}>
            {SHOW_DRAFT_PAGES ? (
              <Link className="pillar__img ripple-host" href={`/explore/${p.slug}`} data-cursor="Explore" tabIndex={-1} aria-hidden="true">
                {img}
              </Link>
            ) : (
              <div className="pillar__img ripple-host">{img}</div>
            )}
            <h3 className="pillar__title">{p.title}</h3>
            <p className="pillar__tag">{p.tag}</p>
            <p className="pillar__body">{p.body}</p>
            {SHOW_DRAFT_PAGES && (
              <Link className="pillar__link" href={`/explore/${p.slug}`}>
                {p.link} <Icon name="arrow" className="i" />
              </Link>
            )}
          </article>
          );
        })}
      </div>
    </section>
  );
}
