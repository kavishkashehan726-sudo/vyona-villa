'use client';

// A form posting to a server action, showing the action's message under it.
// Inputs are disabled while it saves, so nothing is submitted twice.
//
// It submits from onSubmit rather than through the form's action: React resets
// a form after its action runs, which would wipe what the owner typed whenever
// the server says something is wrong. `action` stays for submits without JS.

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Result } from '@/lib/actions';

/** What the form is sending, so the button that was pressed can say so. */
const Sending = createContext<FormData | null>(null);

type Props = {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  children: ReactNode;
  className?: string;
  /** Asks before submitting, for things that can't be undone. */
  confirm?: string;
  /** Clears the inputs after a successful save (forms that add something). */
  resetOnSuccess?: boolean;
  id?: string;
};

export function ActionForm({ action, children, className, confirm, resetOnSuccess, id }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState<FormData | null>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) form.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={form}
      id={id}
      action={formAction}
      className={className}
      aria-busy={pending}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        setSent(fd);
        startTransition(() => formAction(fd));
      }}
    >
      <Sending.Provider value={pending ? sent : null}>
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </Sending.Provider>
      {state && (
        <p key={state.at} className={`note ${state.ok ? 'note--ok' : 'note--error'} form-note`} role={state.ok ? 'status' : 'alert'}>
          {state.message}
        </p>
      )}
    </form>
  );
}

type SubmitProps = { children: ReactNode; busy?: string; className?: string; name?: string; value?: string; disabled?: boolean };

/** A submit button that says what it's doing while its form saves. */
export function Submit({ children, busy, className = 'btn btn--olive', name, value, disabled }: SubmitProps) {
  const data = useContext(Sending);
  // With several submit buttons, only the one that was pressed changes its label.
  const mine = !!data && (!name || data.get(name) === value);
  return (
    <button className={className} name={name} value={value} disabled={disabled}>
      {mine && busy ? busy : children}
    </button>
  );
}
