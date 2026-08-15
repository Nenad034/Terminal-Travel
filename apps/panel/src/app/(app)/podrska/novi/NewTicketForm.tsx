'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createTicket, FormState } from '../actions';

const initialState: FormState = { error: null };
const CATEGORIES = ['REZERVACIJA', 'PLACANJE', 'TEHNICKI_PROBLEM', 'REKLAMACIJA', 'DRUGO'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

// M14 spec §2.1/§6 — polja prate CreateTicketDto (channel je uvek PHONE ovde, requesterType
// uvek STAFF_ON_BEHALF — postavljeno u actions.ts, ne u ovoj formi).
export default function NewTicketForm() {
  const [state, formAction] = useFormState(createTicket, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="naslov">
        <input name="subject" required className="input" />
      </Field>
      <Field label="kategorija">
        <select name="category" required defaultValue="DRUGO" className="input">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="prioritet">
        <select name="priority" defaultValue="NORMAL" className="input">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="nalogodavac (M6 ClientAccount ID, opciono)">
        <input name="requesterClientAccountId" className="input" placeholder="UUID — ostavite prazno ako nije poznat" />
      </Field>
      <Field label="vezana rezervacija (M5 Booking ID, opciono)">
        <input name="relatedBookingId" className="input" placeholder="UUID — ostavite prazno ako nije relevantno" />
      </Field>

      <SubmitButton />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-ink-faint">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Kreiranje…' : 'Kreiraj tiket'}
    </button>
  );
}
