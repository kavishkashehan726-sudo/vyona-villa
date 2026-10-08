import Link from 'next/link';
import { Icon, Logo } from '@vyona/ui';
import { SOCIAL_LABELS, SOCIALS, type ContactDetails } from '@vyona/core';
import { ABOUT_HREF } from '@/lib/content';
import { SOCIAL_ICON } from '@/lib/social';

const LINKS = [
  ['/stay', 'Stay'],
  ['/explore', 'Explore'],
  [ABOUT_HREF, 'About'],
  ['/gallery', 'Gallery'],
  ['/contact', 'Contact'],
] as const;

export function Footer({ social }: { social: ContactDetails['social'] }) {
  return (
    <footer className="footer">
      <Link className="brand brand--foot" href="/" aria-label="VYONA, home">
        <Logo compact className="brand__logo" />
        <span className="brand__sub">Weligama · Sri Lanka</span>
      </Link>
      <nav aria-label="Footer">
        <ul className="footer__links">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <Link href={href}>{label}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="footer__tag">
        {SOCIALS.filter((k) => social[k]).map((k) => (
          <a key={k} href={social[k]} target="_blank" rel="noopener" aria-label={`VYONA on ${SOCIAL_LABELS[k]}`}>
            <Icon name={SOCIAL_ICON[k]} className="i" />
          </a>
        ))}
        Your home on the South Coast.
      </p>
      <p className="footer__legal">© {new Date().getFullYear()} VYONA Weligama</p>
    </footer>
  );
}
