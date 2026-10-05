'use client';

import { useState } from 'react';
import type { Quote } from '@vyona/core';
import { ActionForm, Submit } from '@/components/ActionForm';
import { StayFields, type RoomOption } from '@/components/StayFields';
import { money, usd } from '@/lib/format';
import { moveBooking } from '../actions';

type Props = {
  id: string;
  rooms: RoomOption[];
  total: number;
  currency: string;
  initial: { roomId: string; checkIn: string; checkOut: string; guests: number };
};

export function MoveForm({ id, rooms, total, currency, initial }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pricing, setPricing] = useState<'keep' | 'reprice' | 'custom'>('keep');

  return (
    <ActionForm action={moveBooking.bind(null, id)} className="stack-sm" confirm="Move this booking? The old nights open again.">
      <StayFields rooms={rooms} initial={initial} onQuote={setQuote} />
      <fieldset className="choice">
        <legend className="field__label">Total</legend>
        <label className="check">
          <input type="radio" name="pricing" value="keep" checked={pricing === 'keep'} onChange={() => setPricing('keep')} />
          <span>Keep {money(total, currency)}</span>
        </label>
        <label className="check">
          <input type="radio" name="pricing" value="reprice" checked={pricing === 'reprice'} onChange={() => setPricing('reprice')} />
          <span>Usual price for the new stay{quote ? ` (${usd(quote.total, true)})` : ''}</span>
        </label>
        <label className="check">
          <input type="radio" name="pricing" value="custom" checked={pricing === 'custom'} onChange={() => setPricing('custom')} />
          <span>Another amount</span>
        </label>
        {pricing === 'custom' && (
          <label className="field total-field">
            <span className="sr-only">New total in USD</span>
            <input className="input" name="total" inputMode="decimal" placeholder="240.00" autoFocus required />
          </label>
        )}
      </fieldset>
      <div>
        <Submit busy="Moving…">Move booking</Submit>
      </div>
    </ActionForm>
  );
}
