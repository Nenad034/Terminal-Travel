'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateChannel, FormState } from '../actions';

const initialState: FormState = { error: null };

// M12 spec §7 — PATCH /channels/:code, izmena prikaznog naziva/statusa (aktivan/neaktivan).
export default function ChannelStatusForm({ channelCode, displayName, status }: { channelCode: string; displayName: string; status: string }) {
  const boundAction = updateChannel.bind(null, channelCode);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex items-end gap-2 border-t border-border pt-2 text-[11px]">
      {state.error && <span className="text-danger">{state.error}</span>}
      <label className="text-ink-faint">
        naziv
        <input name="displayName" defaultValue={displayName} className="input mt-1" />
      </label>
      <label className="text-ink-faint">
        status
        <select name="status" defaultValue={status} className="input mt-1">
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-border px-2 py-1 font-medium text-ink-dim hover:border-accent disabled:opacity-50"
    >
      {pending ? 'Čuvanje…' : 'sačuvaj'}
    </button>
  );
}
