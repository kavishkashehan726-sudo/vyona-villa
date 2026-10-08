// Cinematic hero (frontend guide §1): Ken Burns cross-fade over the client's
// photos, palm shadows and lines at their own parallax depths, the headline
// rising out of line masks. Copy from the client's "Homepage main phrase" and brief.
// When footage arrives, swap the slides for <video autoplay muted loop playsinline>.

import Link from 'next/link';
import { Icon, Palm } from '@vyona/ui';
import { Slide } from '../Photo';

const SLIDES = ['hero-pool-sunrise', 'hero-pool-cottage', 'hero-house', 'hero-pool-aerial'];

export function Hero() {
  return (
    <section className="hero" id="top" aria-label="Welcome to VYONA">
      <div className="hero__media" data-hero-media>
        {SLIDES.map((k, i) => (
          <Slide key={k} k={k} active={i === 0} />
        ))}
      </div>
      <HeroFrame />

      <p className="hero__script">
        <span>Weligama</span>
        <span>Sri Lanka</span>
        <svg viewBox="0 0 120 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M3 8c22-5 52-7 82-4 10 1 21 2.6 32 4" />
        </svg>
      </p>

      <div className="hero__content" data-depth="-0.2">
        <h1 className="hero__title">
          <span className="line">
            <span>Your home on</span>
          </span>
          <span className="line">
            <span>the South Coast.</span>
          </span>
          <span className="line">
            <span>
              <em>Naturally.</em>
            </span>
          </span>
        </h1>
        <hr className="rule rule--light" />
        <p className="hero__lede">
          Seven rooms.
          <br />
          Each with a nature of its own.
        </p>
        <Link className="btn btn--glass magnetic" href="/book" data-open-booking data-cursor="Book">
          Book your stay <Icon name="arrow" className="i" />
        </Link>
      </div>

      <aside className="hero__rail" aria-label="The VYONA way">
        <p className="hero__rail-words">
          Stay
          <br />
          Explore
          <br />
          Belong
        </p>
        <hr className="rule rule--light" />
        <p className="hero__rail-small">
          The ocean
          <br />
          is close.
          <br />
          The quiet
          <br />
          is closer.
        </p>
      </aside>

      <div className="hero__dots" role="tablist" aria-label="Hero photos" data-hero-dots>
        {SLIDES.map((k, i) => (
          <button key={k} type="button" role="tab" aria-label={`Photo ${i + 1} of ${SLIDES.length}`} aria-selected={i === 0} />
        ))}
      </div>
      <a className="hero__scroll" href="#welcome" aria-label="Scroll to the next section">
        <span />
      </a>
    </section>
  );
}

/** Shade, palm shadows and light lines shared by the home and subpage heroes. */
export function HeroFrame() {
  return (
    <>
      <div className="hero__shade" aria-hidden="true" />
      <Palm className="hero__palm hero__palm--l" data-depth="0.35" />
      <Palm className="hero__palm hero__palm--r" data-depth="0.55" />
      <div className="hero__lines" data-depth="0.15" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </>
  );
}

/** Subpage head: the hero's frame, shorter, on one photo. */
export function PageHero({ photo, eyebrow, lines, lede }: { photo: string; eyebrow: string; lines: string[]; lede?: string }) {
  return (
    <section className="hero hero--page" aria-label={eyebrow}>
      <div className="hero__media" data-hero-media>
        <Slide k={photo} active />
      </div>
      <HeroFrame />
      <div className="hero__content" data-depth="-0.2">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="hero__title">
          {lines.map((l) => (
            <span className="line" key={l}>
              <span>{l}</span>
            </span>
          ))}
        </h1>
        {lede && (
          <>
            <hr className="rule rule--light" />
            <p className="hero__lede">{lede}</p>
          </>
        )}
      </div>
    </section>
  );
}
