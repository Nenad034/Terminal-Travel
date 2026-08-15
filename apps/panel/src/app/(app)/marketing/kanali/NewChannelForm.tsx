'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createChannel, FormState } from '../actions';

const initialState: FormState = { error: null };
const CHANNELS = ['FACEBOOK', 'INSTAGRAM', 'EMAIL'];

// M12 spec §4/§7 — POST /channels. M8_SITE/MOBILE_PUSH namerno izostavljeni iz izbora (§4 —
// nemaju sopstveni adapter, ne treba im konfiguracija).
export default function NewChannelForm() {
  const [state, formAction] = useFormState(createChannel, initialState);
  return (
    <form action={formAction} className="flex items-end gap-2 rounded-lg border border-border bg-panel p-3 text-xs">
      {state.error && <p className="w-full rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
      <label className="text-ink-faint">
        kanal
        <select name="channelCode" required className="input mt-1">
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex-1 text-ink-faint">
        prikazni naziv
        <input name="displayName" required className="input mt-1" />
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
      className="rounded bg-accent px-3 py-1.5 font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Čuvanje…' : 'dodaj'}
    </button>
  );
}
