import type { Metadata } from 'next';
import { loadContact, loadSettings, MIN_PASSWORD, SOCIAL_LABELS, SOCIALS } from '@vyona/core';
import { ActionForm, Submit } from '@/components/ActionForm';
import { requireAdmin } from '@/lib/session';
import { signOut } from '../../login/actions';
import { saveContact, savePassword, saveSettings } from './actions';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [s, c] = await Promise.all([loadSettings(), loadContact()]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="h1">
            How bookings <em>work</em>
          </h1>
        </div>
      </div>

      <ActionForm action={saveSettings} className="stack">
        <section className="card">
          <h2 className="card__title">Charges</h2>
          <div className="form-grid">
            <Num name="serviceChargePercent" label="Service charge" value={s.serviceChargePercent} unit="%" hint="Added to every stay." />
            <Num name="longStayPercent" label="Long-stay discount" value={s.longStayPercent} unit="%" hint="0 turns it off." />
            <Num name="longStayNights" label="Long stay from" value={s.longStayNights} unit="nights" />
            <Num name="lkrPerUsd" label="Rupees to the dollar" value={s.lkrPerUsd} unit="LKR" hint="For prices shown in rupees on the website." />
            <label className="field">
              <span className="field__label">Charge guests in</span>
              <select className="input" name="chargeCurrency" defaultValue={s.chargeCurrency}>
                <option value="USD">US dollars</option>
                <option value="LKR">Sri Lankan rupees</option>
              </select>
              <span className="field__hint">Whichever your PayHere account accepts.</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">Arrivals and payment</h2>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Check-in from</span>
              <input className="input" type="time" name="checkInTime" defaultValue={s.checkInTime} required />
            </label>
            <label className="field">
              <span className="field__label">Check-out by</span>
              <input className="input" type="time" name="checkOutTime" defaultValue={s.checkOutTime} required />
            </label>
            <Num
              name="holdMinutes"
              label="Time to pay"
              value={s.holdMinutes}
              unit="minutes"
              hint="How long a guest’s nights are held while they pay."
            />
          </div>
          <label className="check">
            <input type="checkbox" name="payAtVilla" defaultChecked={s.payAtVilla} />
            <span>
              Let guests book without paying online
              <span className="field__hint">They pay on arrival. Off means every website booking goes through PayHere.</span>
            </span>
          </label>
        </section>

        <div className="actions">
          <Submit busy="Saving…">Save settings</Submit>
        </div>
      </ActionForm>

      <ActionForm action={saveContact} className="stack">
        <section className="card">
          <h2 className="card__title">Contact details on the website</h2>
          {!c.saved && <p className="hint">The phone, WhatsApp and email below are placeholders until you save this form.</p>}
          <div className="form-grid">
            <label className="field form-grid__wide">
              <span className="field__label">Address</span>
              <input className="input" name="address" defaultValue={c.address} maxLength={200} required />
            </label>
            <label className="field">
              <span className="field__label">Phone</span>
              <input className="input" type="tel" name="phone" defaultValue={c.phone} maxLength={20} required />
              <span className="field__hint">As guests should dial it, with the country code.</span>
            </label>
            <label className="field">
              <span className="field__label">WhatsApp</span>
              <input className="input" type="tel" name="whatsapp" defaultValue={c.whatsapp && `+${c.whatsapp}`} maxLength={25} />
              <span className="field__hint">With the country code. Leave it empty to hide the WhatsApp button.</span>
            </label>
            <label className="field">
              <span className="field__label">Email</span>
              <input className="input" type="email" name="email" defaultValue={c.email} maxLength={120} required />
            </label>
            <label className="field">
              <span className="field__label">Map location</span>
              <input className="input" name="mapQuery" defaultValue={c.mapQuery} maxLength={200} required />
              <span className="field__hint">
                An address, a place name, or exact coordinates like 5.9749, 80.4290 (in Google Maps, right-click the
                villa and click the numbers to copy them).
              </span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2 className="card__title">Social links</h2>
          <p className="hint">Paste the full link to each profile. Empty ones aren’t shown.</p>
          <div className="form-grid">
            {SOCIALS.map((key) => (
              <label className="field" key={key}>
                <span className="field__label">{SOCIAL_LABELS[key]}</span>
                <input className="input" type="url" name={key} defaultValue={c.social[key]} maxLength={300} placeholder="https://" />
              </label>
            ))}
          </div>
        </section>

        <div className="actions">
          <Submit busy="Saving…">Save contact details</Submit>
        </div>
      </ActionForm>

      <section className="card">
        <h2 className="card__title">Your password</h2>
        <p className="hint">Signed in as {admin.email}.</p>
        <ActionForm action={savePassword} className="form-grid form-grid--narrow" resetOnSuccess>
          <input type="text" name="username" autoComplete="username" defaultValue={admin.email} hidden readOnly />
          <label className="field form-grid__wide">
            <span className="field__label">Current password</span>
            <input className="input" type="password" name="current" autoComplete="current-password" required />
          </label>
          <label className="field">
            <span className="field__label">New password</span>
            <input className="input" type="password" name="next" autoComplete="new-password" minLength={MIN_PASSWORD} required />
            <span className="field__hint">At least {MIN_PASSWORD} characters.</span>
          </label>
          <label className="field">
            <span className="field__label">New password again</span>
            <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD} required />
          </label>
          <div className="form-grid__wide">
            <Submit className="btn btn--ghost" busy="Changing…">
              Change password
            </Submit>
          </div>
        </ActionForm>
      </section>

      <form action={signOut} className="only-mobile">
        <button className="btn btn--ghost">Sign out</button>
      </form>
    </>
  );
}

function Num({ name, label, value, unit, hint }: { name: string; label: string; value: number; unit: string; hint?: string }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="money-input money-input--after">
        <input className="input" name={name} type="number" inputMode="numeric" defaultValue={value} required />
        <span aria-hidden="true">{unit}</span>
      </span>
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
