// Filterable gallery with the keyboard/swipe lightbox (client/gallery.ts).
// The home page shows the first `limit` photos and links to /gallery.

import Link from 'next/link';
import { Icon } from '@vyona/ui';
import { GALLERY, GALLERY_FILTERS } from '@/lib/gallery';
import { Photo } from '../Photo';

export function Gallery({ limit, title = 'Moments at VYONA.' }: { limit?: number; title?: string }) {
  const items = limit ? GALLERY.slice(0, limit) : GALLERY;
  return (
    <section className="gallery" id="gallery" data-gallery-section>
      <div className="section-head reveal">
        <div>
          <p className="eyebrow">Gallery</p>
          <h2 className="h2">{title}</h2>
        </div>
        <div className="chips" role="group" aria-label="Filter photos">
          {GALLERY_FILTERS.map((f, i) => (
            <button
              key={f.value}
              type="button"
              className={i === 0 ? 'chip is-active' : 'chip'}
              data-filter={f.value}
              aria-pressed={i === 0}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="gallery__grid" data-gallery>
        {items.map(([k, cat, alt], i) => (
          <li className="gallery__item reveal" data-cat={cat} key={k}>
            <button
              type="button"
              className="gallery__btn ripple-host"
              data-index={i}
              data-key={k}
              data-alt={alt}
              data-cursor="View"
              aria-label={`Open photo: ${alt}`}
            >
              <Photo k={k} className="ripple" alt={alt} />
            </button>
          </li>
        ))}
      </ul>
      {limit && (
        <p className="gallery__more">
          <Link className="link-caps" href="/gallery">
            See all photos <Icon name="arrow" className="i" />
          </Link>
        </p>
      )}

      <dialog className="lightbox" data-lightbox aria-label="Photo viewer">
        <button type="button" className="icon-btn lightbox__close" data-lightbox-close aria-label="Close photo viewer">
          <Icon name="close" className="i" />
        </button>
        <button type="button" className="icon-btn lightbox__prev" data-lightbox-prev aria-label="Previous photo">
          <Icon name="chev" className="i" style={{ transform: 'scaleX(-1)' }} />
        </button>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- filled by client/gallery.ts */}
          <img data-lightbox-img alt="" />
          <figcaption data-lightbox-cap />
        </figure>
        <button type="button" className="icon-btn lightbox__next" data-lightbox-next aria-label="Next photo">
          <Icon name="chev" className="i" />
        </button>
      </dialog>
    </section>
  );
}
