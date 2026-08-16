'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateArticleStatus, FormState } from '../actions';

const initialState: FormState = { error: null };
// PUBLISHED namerno izostavljen ovde — objava ide isključivo kroz PublishButton (poseban PUBLISH
// gate, §3/§8), da EDIT nosilac bez PUBLISH dozvole ne dobije 403 iz ove forme.
const STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'ARCHIVED'];

// M21 spec §6 — PATCH /help/articles/:id. EDIT dozvola dovoljna za svaki prelaz osim u PUBLISHED.
export default function StatusForm({ id, status }: { id: string; status: string }) {
  const boundAction = updateArticleStatus.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select name="status" defaultValue={STATUSES.includes(status) ? status : 'DRAFT'} className="input">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <SubmitButton />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent disabled:opacity-50"
    >
      {pending ? 'Čuvanje…' : 'promeni status'}
    </button>
  );
}
