// The 3D villa (frontend guide §1–3). This is the markup client/villa3d.ts
// binds to: the WebGL stage on capable devices, or the photo slider fallback.

import { Icon } from '@vyona/ui';
import { VILLA_SLIDES, ZONES } from '@/lib/villa';
import { Photo } from '../Photo';

export function Villa3D() {
  return (
    <section className="villa3d" id="villa3d" aria-labelledby="villa3d-title" data-villa3d-section>
      <div className="section-head reveal">
        <div>
          <p className="eyebrow">Find your way around</p>
          <h2 className="h2" id="villa3d-title">
            Walk the grounds before you arrive.
          </h2>
        </div>
        <p className="section-head__aside">Drag to look around. Tap a glowing place to see it.</p>
      </div>
      <div className="villa3d__stage" data-villa3d>
        <canvas className="villa3d__canvas" aria-label="Interactive 3D view of the villa grounds" />
        <div className="villa3d__loading" data-villa3d-loading>
          Loading the villa…
        </div>
        <div className="villa3d__tag" data-villa3d-tag hidden />
        <ul className="villa3d__zones" data-villa3d-zones aria-label="Places in the villa">
          {ZONES.map((z) => (
            <li key={z.id}>
              <button type="button" data-zone={z.id} aria-pressed="false">
                {z.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="villa3d__hint">Drag to orbit · Click, then scroll or pinch to zoom · Tap a glowing place to inspect</p>
        <article className="villa3d__card" data-villa3d-card hidden aria-live="polite">
          <button type="button" className="icon-btn villa3d__close" data-villa3d-close aria-label="Close and return to the full view">
            <Icon name="close" className="i" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- filled by client/villa3d.ts */}
          <img className="blur-img" alt="" width={600} height={800} />
          <div className="villa3d__card-body">
            <p className="eyebrow" />
            <h3 className="h3" />
            <p className="villa3d__card-text" />
            <button type="button" className="btn btn--olive btn--sm magnetic" data-open-booking>
              Check dates
            </button>
          </div>
        </article>
      </div>
      <div className="villa3d__fallback" data-villa3d-fallback hidden>
        <div className="slider" data-slider tabIndex={0} aria-label="Photos of the villa grounds, swipe to browse">
          {VILLA_SLIDES.map(([k, caption], i) => (
            <figure key={k}>
              <Photo k={k} alt={caption} />
              <figcaption>
                {i + 1} · {caption}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="slider__nav">
          <button type="button" className="icon-btn" data-slider-prev aria-label="Previous photo">
            <Icon name="chev" className="i" style={{ transform: 'scaleX(-1)' }} />
          </button>
          <span className="slider__count" data-slider-count>
            1 / {VILLA_SLIDES.length}
          </span>
          <button type="button" className="icon-btn" data-slider-next aria-label="Next photo">
            <Icon name="chev" className="i" />
          </button>
        </div>
      </div>
    </section>
  );
}
