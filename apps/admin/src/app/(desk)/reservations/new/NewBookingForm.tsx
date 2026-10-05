'use client';

import { useState } from 'react';
import type { Quote } from '@vyona/core';
import { ActionForm, Submit } from '@/components/ActionForm';
import { GuestFields } from '@/components/GuestFields';
import { StayFields, type RoomOption } from '@/components/StayFields';
import { createBooking } from '../actions';

type Props = { rooms: RoomOption[]; initial: { roomId: string; checkIn: string; checkOut: string; guests: number } };

export function NewBookingForm({ rooms, initial }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  return (
    <ActionForm action={createBooking} className="stack">
      <section className="card">
        <h2 className="card__title">Stay</h2>
        <StayFields rooms={rooms} initial={initial} onQuote={setQuote} />
        <label className="field total-field">
          <span className="field__label">Agreed total (USD)</span>
          <input className="input" name="total" inputMode="decimal" placeholder={quote ? (quote.total / 100).toFixed(2) : 'Usual price'} />
          <span className="field__hint">Leave blank to charge the usual price, including the service charge.</span>
        </label>
      </section>

      <section className="card">
        <h2 className="card__title">Guest</h2>
        <GuestFields />
        <label className="check">
          <input type="checkbox" name="emailGuest" />
          <span>Email the guest a confirmation</span>
        </label>
      </section>

      <section className="card">
        <h2 className="card__title">Your notes</h2>
        <label className="field">
          <span className="field__label">Only you see these</span>
          <textarea className="input" name="ownerNotes" rows={3} maxLength={2000} placeholder="Paid a deposit in cash, airport pickup…" />
        </label>
      </section>

      <div className="actions">
        <Submit busy="Saving…">Confirm booking</Submit>
      </div>
    </ActionForm>
  );
}
