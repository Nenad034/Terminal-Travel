'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createNotificationChannel, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };
const CHANNEL_TYPES = ['TELEGRAM', 'EMAIL'];

// M18 spec §3 — POST /ops/notification-channels. IN_APP namerno izostavljen iz izbora (spec
// §3/§11 — isporuka ide preko M19 Event Bus pretplate, ne preko ovog kanal-reda).
export default function NewChannelForm() {
  const [state, formAction] = useFormState(createNotificationChannel, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-3 text-xs">
      {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
      <div className="flex items-end gap-2">
        <label className="text-ink-faint">
          tip kanala
          <select name="channelType" required className="input mt-1">
            {CHANNEL_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-ink-faint">
          chatId (Telegram) / email adresa
          <input name="configValue" required className="input mt-1" placeholder="npr. 123456789 ili vlasnik@primer.rs" />
        </label>
        <label className="text-ink-faint">
          uloga primaoca
          <input name="recipientRole" required className="input mt-1" placeholder="npr. VLASNIK" />
        </label>
      </div>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Čuvanje…' : 'dodaj'}
    </Button>
  );
}
