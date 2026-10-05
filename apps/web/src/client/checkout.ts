// Talking to the booking API and handing the guest over to PayHere. Shared by
// the booking widget and the booking page, which offers "Pay now" again after
// a cancelled payment.

export type Checkout = { action: string; method: 'get' | 'post'; fields: Record<string, string> };
export type ApiError = { error: string; message: string; field?: string };
type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export async function call<T>(url: string, body?: unknown, method = 'POST'): Promise<Result<T>> {
  try {
    const r = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) return { ok: true, data: data as T };
    return {
      ok: false,
      error: {
        error: data.error ?? `HTTP_${r.status}`,
        message: data.message ?? 'Something went wrong on our side. Try again in a moment.',
        field: data.field,
      },
    };
  } catch {
    return { ok: false, error: { error: 'NETWORK', message: 'We couldn’t reach the booking server. Check your connection, then try again.' } };
  }
}

/** Leaves the site for the gateway with the server-signed fields. */
export function submitCheckout(c: Checkout) {
  const form = document.createElement('form');
  form.method = c.method;
  form.action = c.action;
  form.hidden = true;
  for (const [name, value] of Object.entries(c.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}

/** Opens a PayHere order for the hold and leaves for it; returns only on failure. */
export async function payByCard(holdId: string) {
  const res = await call<{ checkout: Checkout }>(`/api/bookings/${holdId}/pay`, { method: 'card' });
  if (res.ok) submitCheckout(res.data.checkout);
  return res;
}

// The hold id never appears on a page. This tab keeps it, so a guest who
// cancels at PayHere can pay again from the booking page.
const key = (ref: string) => `vy-hold:${ref}`;

export function rememberHold(ref: string, id: string) {
  try {
    sessionStorage.setItem(key(ref), id);
  } catch {
    /* private mode: paying again just isn't offered */
  }
}

export function heldId(ref: string): string | null {
  try {
    return sessionStorage.getItem(key(ref));
  } catch {
    return null;
  }
}
