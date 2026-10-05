import { payhereConfig, type PayHereNotify } from '@vyona/core';
import { handleNotify } from '@/lib/payhere';

// PayHere posts the payment result here (form-encoded), server to server.
// Only the signature makes it trustworthy; the guest's return to the site
// proves nothing.
export async function POST(req: Request) {
  const cfg = payhereConfig();
  // The mock gateway calls handleNotify directly, never over HTTP.
  if (!cfg || cfg.mock) return new Response('Not found', { status: 404 });

  const form = await req.formData().catch(() => null);
  if (!form) return new Response('Bad request', { status: 400 });
  const p = Object.fromEntries([...form].map(([k, v]) => [k, String(v)])) as PayHereNotify;

  const result = await handleNotify(cfg, p);
  if (result === 'BAD_SIGNATURE') return new Response('Bad signature', { status: 401 });
  return new Response('OK');
}
