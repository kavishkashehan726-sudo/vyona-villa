'use client';

// The tape chart: one row per room, one column per night. Bookings are
// seed-shaped bars from the afternoon they arrive to the morning they leave,
// so a turnover day shows one bar ending and the next starting.
//
// Select nights by dragging (mouse), tapping a first and last night (touch),
// shift-clicking, or with the arrow keys (shift extends, Enter/Space marks,
// Esc clears). The panel under the chart then changes the whole block.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { GridRoom, GridStay } from '@vyona/core';
import { toDate, toIso } from '@vyona/core/dates';
import { Icon, type IconName } from '@vyona/ui';
import { changeNights } from '@/app/(desk)/actions';
import { ActionForm, Submit } from '@/components/ActionForm';
import { plural, shortDate, stayRange, SOURCE_LABEL, STATUS_LABEL, usd } from '@/lib/format';

type Cell = { r: number; d: number };
type Selection = { anchor: Cell; focus: Cell; /** Waiting for the second tap. */ open: boolean };

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });

export function Chart({ rooms, from, days, today }: { rooms: GridRoom[]; from: number; days: number; today: number }) {
  const first = Math.max(0, today - from); // past nights can't be selected
  const [sel, setSel] = useState<Selection | null>(null);
  const [cursor, setCursor] = useState<Cell>({ r: 0, d: Math.min(first, days - 1) });
  const drag = useRef(false);
  const grid = useRef<HTMLDivElement>(null);

  // A new range of dates is a new chart.
  useEffect(() => {
    setSel(null);
    setCursor({ r: 0, d: Math.min(first, days - 1) });
  }, [from, first, days]);

  const clamp = useCallback(
    (c: Cell): Cell => ({ r: Math.max(0, Math.min(rooms.length - 1, c.r)), d: Math.max(first, Math.min(days - 1, c.d)) }),
    [rooms.length, first, days],
  );

  const box = useMemo(() => {
    if (!sel) return null;
    const r0 = Math.min(sel.anchor.r, sel.focus.r);
    const r1 = Math.max(sel.anchor.r, sel.focus.r);
    const d0 = Math.min(sel.anchor.d, sel.focus.d);
    const d1 = Math.max(sel.anchor.d, sel.focus.d);
    return { r0, r1, d0, d1 };
  }, [sel]);

  // Esc clears the selection from anywhere, the panel included.
  useEffect(() => {
    if (!sel) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);

  const inBox = (r: number, d: number) => !!box && r >= box.r0 && r <= box.r1 && d >= box.d0 && d <= box.d1;

  const cellAt = (x: number, y: number): Cell | null => {
    const el = document.elementsFromPoint(x, y).find((e) => e instanceof HTMLElement && e.dataset.d !== undefined) as
      | HTMLElement
      | undefined;
    return el ? { r: Number(el.dataset.r), d: Number(el.dataset.d) } : null;
  };

  const focusCell = (c: Cell) => {
    setCursor(c);
    grid.current?.querySelector<HTMLElement>(`[data-r="${c.r}"][data-d="${c.d}"]`)?.focus({ preventScroll: false });
  };

  /* ---------------------------------------------------------- pointer */

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return; // touch uses taps (onClick), so the chart still scrolls
    const t = e.target as HTMLElement;
    if (t.closest('a, button')) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c || c.d < first) return;
    e.preventDefault();
    setCursor(c);
    if (e.shiftKey && sel) setSel({ ...sel, focus: c, open: false });
    else setSel({ anchor: c, focus: c, open: false });
    drag.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const c = cellAt(e.clientX, e.clientY);
    if (c) setSel((s) => (s ? { ...s, focus: clamp(c) } : s));
  };

  const endDrag = () => {
    drag.current = false;
  };

  const onTap = (c: Cell, pointer: string) => {
    if (pointer === 'mouse' || c.d < first) return;
    setCursor(c);
    setSel((s) => (s?.open ? { ...s, focus: c, open: false } : { anchor: c, focus: c, open: true }));
  };

  /* --------------------------------------------------------- keyboard */

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      Home: [0, -days],
      End: [0, days],
    };
    if (e.key === 'Escape') return; // handled on the window
    if (e.key === 'Enter' || e.key === ' ') {
      if (!(e.target as HTMLElement).dataset.d) return; // let links work
      e.preventDefault();
      setSel((s) => (s?.open ? { ...s, focus: cursor, open: false } : { anchor: cursor, focus: cursor, open: true }));
      return;
    }
    const move = step[e.key];
    if (!move) return;
    e.preventDefault();
    const next = clamp({ r: cursor.r + move[0], d: cursor.d + move[1] });
    focusCell(next);
    if (e.shiftKey) setSel((s) => ({ anchor: s?.anchor ?? cursor, focus: next, open: false }));
    else if (sel?.open) setSel({ ...sel, focus: next });
  };

  /* ------------------------------------------------------------ chart */

  const cols = `var(--label-w) repeat(${days * 2}, var(--half-w))`;
  const nights = Array.from({ length: days }, (_, i) => from + i);

  return (
    <>
      <div className="chart" ref={grid}>
        <div
          className="chart__grid"
          role="grid"
          aria-label="Rooms by night"
          aria-multiselectable="true"
          style={{ ['--cols' as string]: cols }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
        >
          <div className="chart__row chart__row--head" role="row">
            <div className="chart__corner" role="columnheader">
              Room
            </div>
            {nights.map((day, i) => {
              const date = toDate(day);
              const dom = date.getUTCDate();
              return (
                <div
                  key={day}
                  role="columnheader"
                  aria-label={shortDate(day)}
                  className="chart__day"
                  data-today={day === today || undefined}
                  data-weekend={isWeekend(day) || undefined}
                  data-past={day < today || undefined}
                  style={{ gridColumn: `${i * 2 + 2} / span 2` }}
                >
                  <span className="chart__dow">{day === today ? 'Today' : weekday.format(date)}</span>
                  <span className="chart__dom">{dom}</span>
                  {(dom === 1 || i === 0) && <span className="chart__month">{month.format(date)}</span>}
                </div>
              );
            })}
          </div>

          {rooms.map((room, r) => (
            <div className="chart__row" role="row" key={room.id}>
              <div className="chart__room" role="rowheader">
                <Icon name={room.icon as IconName} className="chart__icon" />
                <span>
                  <b>{room.number}</b> {room.name}
                </span>
              </div>
              {room.nights.map((n, d) => {
                const day = from + d;
                const tab = cursor.r === r && cursor.d === d;
                return (
                  <div
                    key={day}
                    role="gridcell"
                    className="chart__cell"
                    data-r={r}
                    data-d={d}
                    data-past={day < today || undefined}
                    data-today={day === today || undefined}
                    data-weekend={isWeekend(day) || undefined}
                    data-blocked={n.blocked || undefined}
                    aria-selected={inBox(r, d)}
                    aria-disabled={day < today || undefined}
                    aria-label={`${room.name}, ${shortDate(day)}: ${n.blocked ? 'closed, ' : ''}${usd(n.price)}${n.custom ? ' (your price)' : ''}${n.minStay ? `, ${n.minStay} night minimum` : ''}`}
                    tabIndex={tab ? 0 : -1}
                    onFocus={() => setCursor({ r, d })}
                    onClick={(e) => onTap({ r, d }, (e.nativeEvent as globalThis.PointerEvent).pointerType ?? 'mouse')}
                    style={{ gridColumn: `${d * 2 + 2} / span 2` }}
                  >
                    {n.minStay && n.minStay > 1 ? <span className="chart__min">{n.minStay}+</span> : null}
                    <span className="chart__price" data-custom={n.custom || undefined}>
                      {usd(n.price)}
                    </span>
                  </div>
                );
              })}
              <div role="gridcell" className="chart__stays">
                {room.stays.map((s) => (
                  <Bar key={s.id} stay={s} from={from} days={days} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {sel && box && (
        <Panel
          key={`${box.r0}-${box.r1}-${box.d0}-${box.d1}`} // a new selection starts without the last message
          rooms={rooms.slice(box.r0, box.r1 + 1)}
          from={from + box.d0}
          until={from + box.d1 + 1}
          waiting={sel.open}
          clear={() => setSel(null)}
        />
      )}
    </>
  );
}

const isWeekend = (day: number) => {
  const w = toDate(day).getUTCDay();
  return w === 5 || w === 6; // Friday and Saturday nights cost more
};

function Bar({ stay, from, days }: { stay: GridStay; from: number; days: number }) {
  // Night i fills grid lines 2+2i to 4+2i; a stay runs from the middle of its
  // first night to the middle of its check-out day.
  const start = Math.max(2, (stay.checkIn - from) * 2 + 3);
  const end = Math.min(days * 2 + 2, (stay.checkOut - from) * 2 + 3);
  const kind = stay.status === 'HOLD' ? 'hold' : stay.source === 'MANUAL' ? 'manual' : stay.source === 'BOOKING_COM' ? 'channel' : 'direct';
  const label = `${stay.guestName}, ${stayRange(stay.checkIn, stay.checkOut)}, ${plural(stay.guests, 'guest')}, ${
    stay.status === 'HOLD' ? STATUS_LABEL.HOLD.toLowerCase() : SOURCE_LABEL[stay.source]
  }. ${stay.ref}`;
  return (
    <Link
      href={`/reservations/${stay.id}`}
      className={`bar bar--${kind}`}
      data-cut-start={stay.checkIn < from || undefined}
      data-cut-end={stay.checkOut > from + days || undefined}
      style={{ gridColumn: `${start} / ${end}` }}
      title={label}
      aria-label={label}
      draggable={false}
    >
      <span>{stay.guestName}</span>
    </Link>
  );
}

function Panel({ rooms, from, until, waiting, clear }: { rooms: GridRoom[]; from: number; until: number; waiting: boolean; clear: () => void }) {
  const nights = until - from;
  const names = rooms.length > 3 ? plural(rooms.length, 'room') : rooms.map((r) => r.name).join(', ');
  const one = rooms.length === 1 ? rooms[0] : null;

  return (
    <section className="panel" aria-label="Selected nights">
      <div className="panel__head">
        <p>
          <b>{names}</b> · {plural(nights, 'night')}, {nights === 1 ? shortDate(from) : `${shortDate(from)} – ${shortDate(until - 1)}`}
          {waiting && <span className="panel__hint"> · tap the last night to extend</span>}
        </p>
        <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
          Clear <span className="sr-only">selection</span>
          <kbd>Esc</kbd>
        </button>
      </div>
      <ActionForm action={changeNights} className="panel__body">
        <input type="hidden" name="rooms" value={rooms.map((r) => r.id).join(',')} />
        <input type="hidden" name="from" value={toIso(from)} />
        <input type="hidden" name="until" value={toIso(until)} />
        <div className="panel__group">
          <span className="field__label">Guests</span>
          <div className="panel__row">
            <Submit name="op" value="close" className="btn btn--ink btn--sm" busy="Closing…">
              Close to guests
            </Submit>
            <Submit name="op" value="open" className="btn btn--ghost btn--sm" busy="Opening…">
              Open
            </Submit>
          </div>
        </div>
        <div className="panel__group">
          <label className="field__label" htmlFor="panel-price">
            Price a night (USD)
          </label>
          <div className="panel__row">
            <input id="panel-price" className="input input--sm panel__num" name="price" inputMode="decimal" placeholder="85" />
            <Submit name="op" value="price" className="btn btn--olive btn--sm" busy="Saving…">
              Set price
            </Submit>
            <Submit name="op" value="reset-price" className="btn btn--ghost btn--sm" busy="Saving…">
              Usual price
            </Submit>
          </div>
        </div>
        <div className="panel__group">
          <label className="field__label" htmlFor="panel-min">
            Minimum stay
          </label>
          <div className="panel__row">
            <input id="panel-min" className="input input--sm panel__num" name="minStay" inputMode="numeric" placeholder="3" />
            <Submit name="op" value="min" className="btn btn--olive btn--sm" busy="Saving…">
              Set
            </Submit>
            <Submit name="op" value="clear-min" className="btn btn--ghost btn--sm" busy="Saving…">
              Remove
            </Submit>
          </div>
        </div>
        {one && (
          <div className="panel__group">
            <span className="field__label">Booking</span>
            <Link className="btn btn--ghost btn--sm" href={`/reservations/new?room=${one.id}&from=${toIso(from)}&to=${toIso(until)}`}>
              New booking for these nights →
            </Link>
          </div>
        )}
      </ActionForm>
    </section>
  );
}
