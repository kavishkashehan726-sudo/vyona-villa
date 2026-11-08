// Maintenance mode (admin Settings → Website): proxy.ts asks maintenanceOn() on every
// request and answers with maintenancePage() while it is on. The setting is read at most
// every few seconds, so switching it in the admin reaches the site almost at once without
// a query per request. Server only: it reads the database.

import { loadContact, loadMaintenance } from '@vyona/core';
import { markSvg } from '@vyona/ui';

const TTL_MS = 5_000;
let cached = { on: false, at: 0 };

export async function maintenanceOn(): Promise<boolean> {
  if (Date.now() - cached.at < TTL_MS) return cached.on;
  let on = false;
  try {
    on = await loadMaintenance();
  } catch {
    // Database down: let the request through; the pages report their own error.
  }
  cached = { on, at: Date.now() };
  return on;
}

export const MAINTENANCE_MESSAGE = 'The website is under maintenance. Please try again later. Thank you for your patience.';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A self-contained page (no app shell, no scripts) in the site's colours and type. */
export async function maintenancePage(): Promise<string> {
  let reach = '';
  try {
    const c = await loadContact();
    const links = [
      c.saved && c.whatsapp && `<a href="https://wa.me/${esc(c.whatsapp)}">WhatsApp</a>`,
      c.saved && c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`,
    ].filter(Boolean);
    if (links.length) reach = `<p class="small">For bookings and enquiries in the meantime</p><p class="links">${links.join('<span>·</span>')}</p>`;
  } catch {
    /* no contact line */
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#f1ece3">
<title>VYONA Weligama · Back soon</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Jost:wght@400;500&display=swap">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; padding: 2rem 16px;
    background: #f1ece3; color: #2b2a26;
    font-family: 'Cormorant Garamond', Georgia, serif; text-align: center;
  }
  main { max-width: 34rem; }
  svg { width: 56px; height: auto; color: #a88b5e; }
  .eyebrow, .small, .links {
    font-family: Jost, 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.22em; text-transform: uppercase;
  }
  .eyebrow { margin: 1.4rem 0 0; font-size: 0.72rem; color: #a88b5e; }
  h1 { margin: 0.9rem 0 0; font-weight: 400; font-size: clamp(2.1rem, 1.4rem + 3vw, 3.2rem); line-height: 1.1; }
  h1 em { color: #a88b5e; }
  p.lede { margin: 1.2rem 0 0; font-size: 1.25rem; line-height: 1.55; color: #6b6457; }
  hr { width: 64px; margin: 2rem auto; border: 0; border-top: 1px solid #a88b5e; }
  .small { margin: 0; font-size: 0.66rem; color: #6b6457; }
  .links { margin: 0.8rem 0 0; font-size: 0.78rem; text-transform: none; letter-spacing: 0.08em; }
  .links span { margin: 0 0.7rem; color: #a88b5e; }
  a { color: #4a4f3a; text-underline-offset: 0.25em; }
</style>
</head>
<body>
<main>
  ${markSvg()}
  <p class="eyebrow">VYONA · Weligama</p>
  <h1>We’ll be back <em>shortly.</em></h1>
  <p class="lede">The website is under maintenance. Please try again later.<br>Thank you for your patience.</p>
  ${reach ? `<hr>${reach}` : ''}
</main>
</body>
</html>`;
}
