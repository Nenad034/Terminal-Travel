'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateTicket, FormState } from '../actions';

const initialState: FormState = { error: null };
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

// M14 spec §3.2/§6 — refundDecision=true uz status=RESOLVED zatvara reklamaciju uz povraćaj
// (okida M10 nacrt storno dokumenta — i dalje ljudska potvrda slanja u M10, ovo samo beleži
// odluku). Prikazuje se samo za category=REKLAMACIJA (isti princip kao ostatak forme).
export default function TicketStatusForm({
  ticketId,
  status,
  priority,
  category,
  refundDecision,
}: {
  ticketId: string;
  status: string;
  priority: string;
  category: string;
  refundDecision: boolean;
}) {
  const boundAction = updateTicket.bind(null, ticketId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [selectedStatus, setSelectedStatus] = useState(status);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <Field label="status">
        <select name="status" defaultValue={status} onChange={(e) => setSelectedStatus(e.target.value)} className="input">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field label="prioritet">
        <select name="priority" defaultValue={priority} className="input">
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>
      <Field label="dodeljeno (M1 User ID, opciono)">
        <input name="assignedTo" className="input" placeholder="UUID" />
      </Field>
      {category === 'REKLAMACIJA' && (
        <label className="flex items-center gap-2 text-xs text-ink-dim">
          <input type="checkbox" name="refundDecision" defaultChecked={refundDecision} className="h-3.5 w-3.5" />
          odluka o povraćaju novca {selectedStatus === 'RESOLVED' ? '(pri čuvanju sada okida M10 nacrt storno dokumenta)' : ''}
        </label>
      )}
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
      className="self-start rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Čuvanje…' : 'Sačuvaj'}
    </button>
  );
}
