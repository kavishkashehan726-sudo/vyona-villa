'use client';

import { useActionState, useState } from 'react';
import { signIn } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  // Controlled, so a wrong password doesn't clear the email too.
  const [email, setEmail] = useState('');
  return (
    <form action={action} className="mt-6 grid gap-5">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span className="field__label">Email</span>
        <input className="input" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span className="field__label">Password</span>
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </label>
      {state && !state.ok && (
        <p className="note note--error" role="alert">
          {state.message}
        </p>
      )}
      <button className="btn btn--olive mt-2 w-full" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
