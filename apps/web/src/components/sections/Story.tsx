// Alternating photo + text blocks for the Explore pillar pages and About.
// Photos drift inside their frames like the home page pillars.

import type { StoryBlock } from '@/lib/content';
import { Photo } from '../Photo';

export function Story({ blocks, note }: { blocks: StoryBlock[]; note?: string }) {
  return (
    <section className="story" aria-label="Story">
      {blocks.map((b, i) => (
        <article className="story__block" key={b.title}>
          <figure className="story__media unveil ripple-host">
            <span className="story__parallax" data-parallax={0.08 + (i % 3) * 0.04}>
              <Photo k={b.photo} className="ripple" alt={b.alt} />
            </span>
          </figure>
          <div className="story__text reveal">
            <p className="eyebrow">{b.eyebrow}</p>
            <h2 className="h2">{b.title}</h2>
            <hr className="rule" />
            {b.text.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        </article>
      ))}
      {note && <p className="proto-note">{note}</p>}
    </section>
  );
}
