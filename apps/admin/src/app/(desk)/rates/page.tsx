import type { Metadata } from 'next';
import Link from 'next/link';
import { loadSettings } from '@vyona/core';
import { prisma } from '@vyona/db';
import { Icon, type IconName } from '@vyona/ui';
import { ActionForm, Submit } from '@/components/ActionForm';
import { requireAdmin } from '@/lib/session';
import { usd } from '@/lib/format';
import { deleteRule, saveBaseRates, saveRule } from './actions';

export const metadata: Metadata = { title: 'Rates' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Weekdays are the night's own day: a Friday night is the stay from Friday to Saturday.
const DAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
] as const;

type Rule = { id: string; name: string; months: number[]; weekdays: number[]; percent: number; active: boolean };

export default async function RatesPage() {
  await requireAdmin();
  const [rooms, rules, settings] = await Promise.all([
    prisma.room.findMany({ where: { active: true }, orderBy: { number: 'asc' } }),
    prisma.rateRule.findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }] }),
    loadSettings(),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Rates</p>
          <h1 className="h1">
            What a night <em>costs</em>
          </h1>
          <p className="lede">
            Each room has a base rate. Rules raise or lower it by season and day of the week, and stack when several apply. A price you set
            on the calendar replaces both for that night.
          </p>
        </div>
      </div>

      <section className="card">
        <h2 className="card__title">Base rates, a night</h2>
        <ActionForm action={saveBaseRates} className="stack-sm">
          <ul className="rates">
            {rooms.map((room) => (
              <li key={room.id}>
                <label className="rates__row" htmlFor={`rate-${room.id}`}>
                  <Icon name={room.icon as IconName} className="rates__icon" />
                  <span className="rates__name">
                    <b>{room.number}</b> {room.name}
                    <span className="table__sub">
                      {room.category}, sleeps {room.maxGuests}
                    </span>
                  </span>
                </label>
                <span className="money-input">
                  <span aria-hidden="true">$</span>
                  <input
                    id={`rate-${room.id}`}
                    className="input input--sm"
                    name={`rate:${room.id}`}
                    inputMode="decimal"
                    defaultValue={(room.baseRate / 100).toString()}
                    required
                  />
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Submit busy="Saving…">Save rates</Submit>
          </div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="card__title">Rules</h2>
        {rules.length === 0 && <p className="hint">No rules, so every night costs the base rate.</p>}
        <div className="rules">
          {rules.map((rule) => (
            <RuleForm key={rule.id} rule={rule} example={rooms[0]?.baseRate} />
          ))}
        </div>
        <details className="add-rule">
          <summary className="btn btn--ghost btn--sm">Add a rule</summary>
          <RuleForm example={rooms[0]?.baseRate} />
        </details>
      </section>

      <p className="hint">
        Service charge {settings.serviceChargePercent}% and the long-stay discount ({settings.longStayPercent}% off at{' '}
        {settings.longStayNights}+ nights) are under <Link href="/settings">Settings</Link>.
      </p>
    </>
  );
}

function RuleForm({ rule, example }: { rule?: Rule; example?: number }) {
  const key = rule?.id ?? 'new';
  return (
    <div className="rule" data-off={rule && !rule.active ? true : undefined}>
      <ActionForm action={saveRule.bind(null, rule?.id ?? null)} className="rule__form" resetOnSuccess={!rule}>
        <div className="rule__top">
          <label className="field rule__name">
            <span className="field__label">Name</span>
            <input className="input input--sm" name="name" defaultValue={rule?.name} placeholder="Peak season" required maxLength={80} />
          </label>
          <label className="field rule__pct">
            <span className="field__label">Change</span>
            <span className="money-input money-input--after">
              <input
                className="input input--sm"
                name="percent"
                inputMode="numeric"
                defaultValue={rule?.percent}
                placeholder="+20"
                required
                aria-describedby={`pct-${key}`}
              />
              <span aria-hidden="true">%</span>
            </span>
          </label>
          <label className="check rule__active">
            <input type="checkbox" name="active" defaultChecked={rule?.active ?? true} />
            <span>On</span>
          </label>
        </div>
        <fieldset className="chips">
          <legend className="field__label">Months (none ticked: all year)</legend>
          {MONTHS.map((m, i) => (
            <label key={m} className="chip-toggle">
              <input type="checkbox" name="months" value={i + 1} defaultChecked={rule?.months.includes(i + 1)} />
              <span>{m}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="chips">
          <legend className="field__label">Nights of the week (none ticked: every night)</legend>
          {DAYS.map(([d, label]) => (
            <label key={d} className="chip-toggle">
              <input type="checkbox" name="weekdays" value={d} defaultChecked={rule?.weekdays.includes(d)} />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        <p className="field__hint" id={`pct-${key}`}>
          Use a minus for a discount.
          {rule && example ? ` A ${usd(example)} room becomes ${usd(Math.round((example * (1 + rule.percent / 100)) / 100) * 100)}.` : ''}
        </p>
        <div className="rule__actions">
          <Submit className="btn btn--olive btn--sm" busy="Saving…">
            {rule ? 'Save rule' : 'Add rule'}
          </Submit>
        </div>
      </ActionForm>
      {rule && (
        <ActionForm action={deleteRule.bind(null, rule.id)} className="rule__delete" confirm={`Delete “${rule.name}”?`}>
          <Submit className="btn btn--text btn--sm" busy="Deleting…">
            Delete
          </Submit>
        </ActionForm>
      )}
    </div>
  );
}
