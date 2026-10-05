'use client';

// The live part of /book/[ref] while a hold waits for its payment. PayHere
// sends the guest back before (or after) its notify reaches the server, so the
// page re-reads itself for a while instead of asking the guest to reload. If
// they cancelled at PayHere and this tab still holds the booking, they can try
// again without starting over.

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { heldId, payByCard } from '@/client/checkout';

const EVERY_MS = 3000;
const FOR_MS = 90_000;

export function PaymentStatus({ bookingRef, waiting, canRetry }: { bookingRef: string; waiting: boolean; canRetry: boolean }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);
  const [holdId, setHoldId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > FOR_MS) {
        clearInterval(t);
        setTimedOut(true);
      } else router.refresh();
    }, EVERY_MS);
    return () => clearInterval(t);
  }, [waiting, router]);

  // sessionStorage only exists in the browser, so this can't run during render.
  useEffect(() => setHoldId(heldId(bookingRef) ?? ''), [bookingRef]);

  const retry = async () => {
    setBusy(true);
    setError('');
    const res = await payByCard(holdId);
    // On success the browser is on its way to PayHere.
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
    }
  };

  return (
    <>
      {waiting && !timedOut && (
        <p className="ref__wait" role="status">
          <span className="ref__spinner" aria-hidden="true" /> Waiting for PayHere to confirm your payment…
        </p>
      )}
      {waiting && timedOut && (
        <p className="ref__note" role="status">
          PayHere hasn&rsquo;t confirmed the payment yet. If you were charged, your confirmation email will follow
          shortly. Reload this page to check again.
        </p>
      )}
      {canRetry && holdId && (
        <p className="mock-pay">
          <button type="button" className="btn btn--olive magnetic" onClick={retry} disabled={busy} aria-busy={busy}>
            {busy ? 'Opening PayHere…' : 'Try paying again'}
          </button>
        </p>
      )}
      {error && (
        <p className="ref__note ref__note--error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
