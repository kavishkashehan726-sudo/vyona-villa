import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { payhereConfig, verifyCheckout } from '@vyona/core';

// Stands in for PayHere's checkout page in development, until the client's
// merchant account exists. The widget sends the same signed fields here that
// it would post to PayHere, and this page checks the signature the same way.
export const metadata: Metadata = { title: 'Test payment', robots: { index: false, follow: false } };

export default async function MockGateway({ searchParams }: PageProps<'/book/pay/mock'>) {
  const cfg = payhereConfig();
  if (!cfg?.mock) notFound();
  const sp = await searchParams;
  const f = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const signed = verifyCheckout(cfg, f);
  const amount = `${f.currency === 'LKR' ? 'LKR' : 'US$'} ${f.amount}`;

  return (
    <>
      <div className="page-top" />
      <section className="ref" aria-labelledby="mock-title">
        <p className="ref__status">Test gateway</p>
        <h1 className="h2" id="mock-title">
          Pay {amount}
        </h1>
        <p>Stands in for PayHere while the merchant account is set up. No card is charged.</p>
        <dl className="bk__summary">
          <dt>For</dt>
          <dd>{f.items}</dd>
          <dt>Guest</dt>
          <dd>
            {f.first_name} {f.last_name}
          </dd>
          <dt>Order</dt>
          <dd>{f.order_id}</dd>
          <dt className="bk__total">Amount</dt>
          <dd className="bk__total">{amount}</dd>
        </dl>
        {signed ? (
          <form method="post" action="/api/payhere/mock" className="mock-pay">
            <input type="hidden" name="order_id" value={f.order_id} />
            <button className="btn btn--olive" name="outcome" value="paid">
              Pay {amount}
            </button>
            <button className="btn btn--line btn--sm" name="outcome" value="cancelled">
              Cancel payment
            </button>
          </form>
        ) : (
          <p className="proto-note">The checkout signature doesn’t match, so PayHere would refuse this payment.</p>
        )}
      </section>
    </>
  );
}
