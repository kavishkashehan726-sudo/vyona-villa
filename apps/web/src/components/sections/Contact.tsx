// Contact details (placeholders) and the lazy Google Map, the only
// third-party request on the site.

import { Icon } from '@vyona/ui';
import { CONTACT } from '@/lib/site';

export function Contact({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="contact__text reveal">
        <p className="eyebrow">Find us</p>
        <H className="h2" id="contact-title">
          Just beyond the bustle of Weligama.
        </H>
        <p>
          Ten minutes on foot to the beach, a short tuk-tuk ride to Mirissa. Message us any time: we&rsquo;re happy to
          arrange airport pickups, surf lessons or a table for dinner.
        </p>
        <ul className="contact__list">
          <li>
            <Icon name="pin" className="i" />
            <span>
              {CONTACT.street}, {CONTACT.town}, {CONTACT.country}
            </span>
          </li>
          <li>
            <Icon name="phone" className="i" />
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          </li>
          <li>
            <Icon name="mail" className="i" />
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </li>
          <li>
            <Icon name="insta" className="i" />
            <a href={CONTACT.instagramHref} rel="noopener">
              {CONTACT.instagram}
            </a>
          </li>
        </ul>
        <a className="btn btn--line magnetic" href={CONTACT.whatsapp} target="_blank" rel="noopener" data-cursor="Chat">
          <Icon name="whatsapp" className="i" /> Message us on WhatsApp
        </a>
        <p className="proto-note">Address, phone, email and social handles are placeholders.</p>
      </div>
      <div className="contact__map" data-map>
        <div className="contact__map-fallback">
          <Icon name="pin" className="i-lg" />
          <p>
            Weligama, Southern Province
            <br />
            <small>The map loads when you&rsquo;re online.</small>
          </p>
        </div>
      </div>
    </section>
  );
}
