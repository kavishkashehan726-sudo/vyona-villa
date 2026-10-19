import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTACT, followMapLink, mapEmbedSrc, mapsHref, parseMapLink } from './contact';
import { externalBookingUrl, normaliseBookingComUrl } from './settings';

describe('parseMapLink', () => {
  it('takes the pin from a place URL', () => {
    const href =
      'https://www.google.com/maps/place/VYONA+Weligama/@5.9741,80.4255,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x1!8m2!3d5.9749!4d80.429!16s';
    expect(parseMapLink(href)).toEqual({
      kind: 'place',
      link: href,
      embed: 'https://www.google.com/maps?q=5.9749%2C%2080.429&z=15&output=embed',
    });
  });

  it('falls back to the place name, then the view centre', () => {
    expect(parseMapLink('https://www.google.com/maps/place/VYONA+Weligama/')).toMatchObject({
      embed: 'https://www.google.com/maps?q=VYONA%20Weligama&z=15&output=embed',
    });
    expect(parseMapLink('https://www.google.com/maps/@5.97,80.42,15z')).toMatchObject({
      embed: 'https://www.google.com/maps?q=5.97%2C%2080.42&z=15&output=embed',
    });
    expect(parseMapLink('maps.google.com/?q=Weligama')).toMatchObject({ kind: 'place', link: 'https://maps.google.com/?q=Weligama' });
  });

  it('keeps an embed URL, or the src of the embed code', () => {
    const src = 'https://www.google.com/maps/embed?pb=!1m18!1m12!3d5.97!4d80.42';
    expect(parseMapLink(src)).toEqual({ kind: 'embed', embed: src });
    expect(parseMapLink(`<iframe src="${src}&amp;x=1" width="600" height="450"></iframe>`)).toEqual({
      kind: 'embed',
      embed: `${src}&x=1`,
    });
  });

  it('marks share links to follow, and refuses anything else', () => {
    expect(parseMapLink('https://maps.app.goo.gl/AbC123')).toEqual({ kind: 'short', link: 'https://maps.app.goo.gl/AbC123' });
    expect(parseMapLink('https://goo.gl/maps/AbC123')).toMatchObject({ kind: 'short' });
    expect(parseMapLink('https://goo.gl/AbC123')).toBeNull();
    expect(parseMapLink('https://example.com/maps/place/x')).toBeNull();
    expect(parseMapLink('https://www.google.com/search?q=vyona')).toBeNull();
    expect(parseMapLink('not a link')).toBeNull();
  });
});

describe('followMapLink', () => {
  const redirects = (hops: Record<string, string>) =>
    (async (url: string) =>
      hops[url]
        ? new Response(null, { status: 302, headers: { location: hops[url] } })
        : new Response('', { status: 200 })) as unknown as typeof fetch;

  it('follows a share link to the place URL, through the cookie page', async () => {
    const place = 'https://www.google.com/maps/place/VYONA/@5.97,80.42,17z';
    const fetcher = redirects({
      'https://maps.app.goo.gl/AbC': `https://consent.google.com/m?continue=${encodeURIComponent(place)}`,
    });
    expect(await followMapLink('https://maps.app.goo.gl/AbC', fetcher)).toBe(place);
  });

  it('gives up when Google answers with something else', async () => {
    expect(await followMapLink('https://maps.app.goo.gl/AbC', redirects({}))).toBeNull();
    const down = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await followMapLink('https://maps.app.goo.gl/AbC', down)).toBeNull();
  });
});

describe('map on the website', () => {
  it('uses the stored embed, else searches the map location', () => {
    expect(mapEmbedSrc({ mapQuery: 'Weligama', mapEmbed: '' })).toBe('https://www.google.com/maps?q=Weligama&z=15&output=embed');
    const embed = 'https://www.google.com/maps/embed?pb=x';
    expect(mapEmbedSrc({ mapQuery: 'Weligama', mapEmbed: embed })).toBe(embed);
    expect(mapEmbedSrc({ mapQuery: 'Weligama', mapEmbed: 'https://evil.example/' })).toContain('q=Weligama');
  });

  it('opens the owner’s link, else a search', () => {
    expect(mapsHref({ ...DEFAULT_CONTACT, mapLink: 'https://maps.app.goo.gl/AbC' })).toBe('https://maps.app.goo.gl/AbC');
    expect(mapsHref({ mapQuery: '5.97, 80.42', mapLink: '' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=5.97%2C%2080.42',
    );
  });
});

describe('booking on Booking.com', () => {
  it('accepts only Booking.com pages, over https', () => {
    expect(normaliseBookingComUrl('www.booking.com/hotel/lk/vyona.html')).toBe('https://www.booking.com/hotel/lk/vyona.html');
    expect(normaliseBookingComUrl('http://booking.com/hotel/lk/vyona.html')).toBe('https://booking.com/hotel/lk/vyona.html');
    expect(normaliseBookingComUrl('https://evilbooking.com/')).toBeNull();
    expect(normaliseBookingComUrl('https://booking.com.evil.example/')).toBeNull();
    expect(normaliseBookingComUrl('')).toBeNull();
  });

  it('sends guests there only while online booking is off and a link is set', () => {
    const url = 'https://www.booking.com/hotel/lk/vyona.html';
    expect(externalBookingUrl({ onlineBooking: true, bookingComUrl: url })).toBeNull();
    expect(externalBookingUrl({ onlineBooking: false, bookingComUrl: url })).toBe(url);
    expect(externalBookingUrl({ onlineBooking: false, bookingComUrl: '' })).toBeNull();
  });
});
