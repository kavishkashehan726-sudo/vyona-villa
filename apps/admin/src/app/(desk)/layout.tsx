import type { ReactNode } from 'react';
import { loadMaintenance } from '@vyona/core';
import { Mark } from '@vyona/ui';
import { requireAdmin } from '@/lib/session';
import { signOut } from '../login/actions';
import { Nav } from '@/components/Nav';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const maintenance = await loadMaintenance();
  return (
    <div className="shell">
      <header className="rail">
        <a className="rail__brand" href="/" aria-label="VYONA admin, calendar">
          <Mark className="rail__mark" />
          <span>VYONA</span>
        </a>
        <Nav />
        <div className="rail__foot">
          <a className="rail__site" href={SITE_URL} target="_blank" rel="noreferrer">
            View the site ↗
          </a>
          <p className="rail__who">
            {admin.name}
            <span>{admin.email}</span>
          </p>
          <form action={signOut}>
            <button className="rail__out">Sign out</button>
          </form>
        </div>
      </header>
      <main className="desk" id="main">
        {maintenance && (
          <p className="note">
            The website is in maintenance mode: visitors see the maintenance page.{' '}
            <a href="/settings#maintenance">Turn it off in Settings</a>.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
