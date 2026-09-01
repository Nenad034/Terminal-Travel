'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { createTicket, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };
const CATEGORIES = ['REZERVACIJA', 'PLACANJE', 'TEHNICKI_PROBLEM', 'REKLAMACIJA', 'DRUGO'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

// M14 spec §2.1/§6 — polja prate CreateTicketDto (channel je uvek PHONE ovde, requesterType
// uvek STAFF_ON_BEHALF — postavljeno u actions.ts, ne u ovoj formi).
export default function NewTicketForm({ defaultBookingId = '' }: { defaultBookingId?: string }) {
  const [state, formAction] = useActionState(createTicket, initialState);

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
      {/* Predpopunjeno kad se dolazi sa ekrana rezervacije (kartica "Reklamacije",
          M5 spec §4.5) — ručno kucanje UUID-a je bio jedini raniji način. */}
      <Field label="vezana rezervacija (M5 Booking ID, opciono)">
        <input
          name="relatedBookingId"
          defaultValue={defaultBookingId}
          readOnly={Boolean(defaultBookingId)}
          className="input"
          placeholder="UUID — ostavite prazno ako nije relevantno"
        />
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
    <Button type="submit" disabled={pending} className="mt-1 self-start">
      {pending ? 'Kreiranje…' : 'Kreiraj tiket'}
    </Button>
  );
}
