'use client';

// Room, dates and party size, with the usual price worked out as they change.
// Used by the new-booking form and by "change dates or room".

import { useEffect, useState, useTransition } from 'react';
import type { Quote } from '@vyona/core';
import { quoteStay } from '@/app/(desk)/reservations/actions';
import { plural, usd } from '@/lib/format';

export type RoomOption = { id: string; number: number; name: string; maxGuests: number };

type Props = {
  rooms: RoomOption[];
  initial: { roomId: string; checkIn: string; checkOut: string; guests: number };
  /** Reports the usual price so the parent can compare a custom total with it. */
  onQuote?: (q: Quote | null) => void;
};

export function StayFields({ rooms, initial, onQuote }: Props) {
  const [stay, setStay] = useState(initial);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const room = rooms.find((r) => r.id === stay.roomId);

  useEffect(() => {
    if (!stay.roomId || !stay.checkIn || !stay.checkOut) {
      setQuote(null);
      onQuote?.(null);
      return;
    }
    let live = true;
    start(async () => {
      const res = await quoteStay(stay.roomId, stay.checkIn, stay.checkOut);
      if (!live) return;
      const q = 'quote' in res ? res.quote : null;
      setQuote(q);
      setError('error' in res ? res.error : '');
      onQuote?.(q);
    });
    return () => {
      live = false;
    };
    // onQuote is a setter from the parent; the quote depends on the stay only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stay.roomId, stay.checkIn, stay.checkOut]);

  const set = (k: keyof typeof stay) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setStay((s) => ({ ...s, [k]: k === 'guests' ? Number(e.target.value) : e.target.value }));

  return (
    <div className="stay-fields">
      <label className="field stay-fields__room">
        <span className="field__label">Room</span>
        <select className="input" name="roomId" value={stay.roomId} onChange={set('roomId')} required>
          <option value="" disabled>
            Choose a room
          </option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.number} · {r.name} (sleeps {r.maxGuests})
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Check-in</span>
        <input className="input" type="date" name="checkIn" value={stay.checkIn} onChange={set('checkIn')} required />
      </label>
      <label className="field">
        <span className="field__label">Check-out</span>
        <input className="input" type="date" name="checkOut" value={stay.checkOut} min={stay.checkIn || undefined} onChange={set('checkOut')} required />
      </label>
      <label className="field">
        <span className="field__label">Guests</span>
        <select className="input" name="guests" value={stay.guests} onChange={set('guests')}>
          {Array.from({ length: Math.max(room?.maxGuests ?? 3, stay.guests) }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>

      <div className="quote" aria-live="polite" aria-busy={pending}>
        {error ? (
          <p className="note note--error">{error}</p>
        ) : quote ? (
          <dl className="quote__lines">
            <div>
              <dt>{plural(quote.nights.length, 'night')}</dt>
              <dd>{usd(quote.subtotal, true)}</dd>
            </div>
            {quote.discount > 0 && (
              <div>
                <dt>Long-stay discount</dt>
                <dd>−{usd(quote.discount, true)}</dd>
              </div>
            )}
            <div>
              <dt>Service charge</dt>
              <dd>{usd(quote.serviceCharge, true)}</dd>
            </div>
            <div className="quote__total">
              <dt>Usual price</dt>
              <dd>{usd(quote.total, true)}</dd>
            </div>
          </dl>
        ) : (
          <p className="hint">Choose a room and dates to see the price.</p>
        )}
      </div>
    </div>
  );
}
