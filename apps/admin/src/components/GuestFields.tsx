// The guest's details, shared by the new-booking and edit forms.

type Guest = { name?: string; email?: string; phone?: string | null; country?: string | null; arrivalTime?: string | null; notes?: string | null };

export function GuestFields({ guest = {} }: { guest?: Guest }) {
  return (
    <div className="form-grid">
      <label className="field form-grid__wide">
        <span className="field__label">Name</span>
        <input className="input" name="name" defaultValue={guest.name} required minLength={2} maxLength={120} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field__label">Email</span>
        <input className="input" type="email" name="email" defaultValue={guest.email} maxLength={200} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field__label">Phone or WhatsApp</span>
        <input className="input" type="tel" name="phone" defaultValue={guest.phone ?? ''} maxLength={40} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field__label">Country</span>
        <input className="input" name="country" defaultValue={guest.country ?? ''} maxLength={80} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field__label">Arriving around</span>
        <input className="input" name="arrivalTime" defaultValue={guest.arrivalTime ?? ''} maxLength={40} placeholder="15:00" autoComplete="off" />
      </label>
      <label className="field form-grid__wide">
        <span className="field__label">Guest’s requests</span>
        <textarea className="input" name="notes" defaultValue={guest.notes ?? ''} rows={3} maxLength={2000} />
      </label>
    </div>
  );
}
