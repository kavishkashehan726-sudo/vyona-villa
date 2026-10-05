import Link from 'next/link';
import { Icon, Palm } from '@vyona/ui';
import { Photo } from '../Photo';

export function Welcome() {
  return (
    <section className="welcome" id="welcome">
      <div className="welcome__text reveal">
        <p className="eyebrow">Welcome to VYONA</p>
        <h2 className="h2">
          A different kind
          <br />
          of stay in Weligama.
        </h2>
        <hr className="rule" />
        <p>
          Set among palms and tropical greenery, just beyond the bustle of Weligama, VYONA is a seven-room boutique
          villa made for slower days and easy living.
        </p>
        <p>
          Here, nature isn&rsquo;t a theme. It&rsquo;s simply part of the place: sunlight through the windows, birds
          in the garden, the breeze in the palms and the ocean just down the road.
        </p>
        <Link className="link-arrow" href="/about">
          <span className="link-arrow__line" aria-hidden="true" />
          Our story <Icon name="arrow" className="i" />
        </Link>
      </div>
      <figure className="welcome__photo unveil">
        <Photo k="door-statue" alt="A carved timber door beside a stone statue and a potted palm at VYONA" />
      </figure>
      <aside className="welcome__quote reveal">
        <Palm className="welcome__quote-palm" />
        <blockquote>
          “Not just a<br />
          destination.
          <br />A different pace.”
        </blockquote>
        <hr className="rule rule--light" />
        <ul className="welcome__values">
          <li>People</li>
          <li>Nature</li>
          <li>Simple luxury</li>
          <li>Real connections</li>
        </ul>
      </aside>
    </section>
  );
}
