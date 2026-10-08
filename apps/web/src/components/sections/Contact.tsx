// Contact details (set by the owner in the admin's settings) and the lazy
// Google Map, the only third-party request on the site. Copy is the client's.

import { phoneHref, SOCIAL_LABELS, SOCIALS, whatsappHref } from '@vyona/core';
import { Icon } from '@vyona/ui';
import { getContact } from '@/lib/site';
import { SOCIAL_ICON, socialText } from '@/lib/social';

export async function Contact({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const c = await getContact();
  return (
    <section className="contact" id="contact" aria-labelledby="contact-title">
      <div className="contact__text reveal">
        <p className="eyebrow">Find us</p>
        <H className="h2" id="contact-title">
          Close to Weligama.
          <br />A little closer to nature.
        </H>
        <p>
          VYONA sits just inland from Weligama, surrounded by tropical greenery and away from the busiest part of town.
          The beach, caf&eacute;s and restaurants are all close by&nbsp;&mdash; while back at VYONA, things feel
          altogether quieter.
        </p>
        <p>
          Need a tuk-tuk, airport transfer, surf lesson or dinner recommendation? We&rsquo;re always happy to help.
        </p>
        <ul className="contact__list">
          <li>
            <Icon name="pin" className="i" />
            <span>{c.address}</span>
          </li>
          <li>
            <Icon name="phone" className="i" />
            <a href={phoneHref(c.phone)}>{c.phone}</a>
          </li>
          <li>
            <Icon name="mail" className="i" />
            <a href={`mailto:${c.email}`}>{c.email}</a>
          </li>
          {SOCIALS.filter((k) => c.social[k]).map((k) => (
            <li key={k}>
              <Icon name={SOCIAL_ICON[k]} className="i" />
              <a href={c.social[k]} target="_blank" rel="noopener" aria-label={`VYONA on ${SOCIAL_LABELS[k]}`}>
                {socialText(k, c.social[k])}
              </a>
            </li>
          ))}
        </ul>
        {c.whatsapp && (
          <a className="btn btn--line magnetic" href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener" data-cursor="Chat">
            <Icon name="whatsapp" className="i" /> Message us on WhatsApp
          </a>
        )}
        {!c.saved && <p className="proto-note">Phone, WhatsApp and email are placeholders.</p>}
      </div>
      <div className="contact__map" data-map data-map-q={c.mapQuery}>
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
