// Full-bleed parallax statement: the guide's y -20% → 15%, scale 1.15 → 1 recipe
// (client/motion.ts) on the background photo.

import { Mark } from '@vyona/ui';
import { Photo } from '../Photo';

export function Statement() {
  return (
    <section className="statement" data-statement aria-label="About the villa">
      <div className="statement__bg">
        <Photo k="pool-loungers" alt="" data-statement-img />
      </div>
      <div className="statement__card reveal">
        <Mark className="statement__mark" />
        <h2 className="h2">Built for lasting memories.</h2>
        <p>
          Whitewashed walls, teak floors and wide verandahs, set around a pool that catches the first light through the
          trees. Nothing here is in a hurry, and neither are you.
        </p>
      </div>
    </section>
  );
}
