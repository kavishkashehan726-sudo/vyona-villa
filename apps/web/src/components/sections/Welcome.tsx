import Link from 'next/link';
import { Icon, Palm } from '@vyona/ui';
import { SHOW_DRAFT_PAGES } from '@/lib/content';
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
          Set among palms and tropical greenery, VYONA is a seven-room hideaway made for easy days, good food and time
          spent outdoors.
        </p>
        <p className="welcome__em">
          Here, nature isn&rsquo;t a theme. It&rsquo;s simply who we are. Sunlight through the windows, birds in the
          garden, a breeze through the palms and the paddy just beyond.
        </p>
        <p>
          The beach is close, but there&rsquo;s plenty to stay for&nbsp;&mdash; a swim in the pool, breakfast
          overlooking the paddy, a quiet corner in the garden, or simply nowhere you need to be.
        </p>
        <p className="welcome__sign">Make yourself at home.</p>
        {SHOW_DRAFT_PAGES && (
          <Link className="link-arrow" href="/about">
            <span className="link-arrow__line" aria-hidden="true" />
            Our story <Icon name="arrow" className="i" />
          </Link>
        )}
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
