import { Icon } from '@vyona/ui';
import { AMENITIES } from '@/lib/content';

export function Amenities() {
  return (
    <section className="amenities" aria-label="What's included">
      <ul>
        {AMENITIES.map(({ icon, lines: [a, b] }) => (
          <li key={a}>
            <Icon name={icon} className="i-lg" />
            <span>
              {a}
              <br />
              {b}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
