import Link from 'next/link';
import { Icon } from '@vyona/ui';
import { CONTACT } from '@/lib/site';

const LINKS = [
  ['/stay', 'Stay'],
  ['/explore', 'Explore'],
  ['/about', 'About'],
  ['/gallery', 'Gallery'],
  ['/contact', 'Contact'],
] as const;

export function Footer() {
  return (
    <footer className="footer">
      <Link className="brand brand--foot" href="/" aria-label="VYONA, home">
        <span className="brand__word">VYONA</span>
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
        <a href={CONTACT.instagramHref} aria-label="VYONA on Instagram" rel="noopener">
          <Icon name="insta" className="i" />
        </a>
        Your home on the South Coast.
      </p>
      <p className="footer__legal">© {new Date().getFullYear()} VYONA Weligama</p>
    </footer>
  );
}
