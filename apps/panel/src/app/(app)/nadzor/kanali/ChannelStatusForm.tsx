'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateNotificationChannelStatus, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M18 spec §3/§9 — PATCH /ops/notification-channels/:id, izmena statusa (ACTIVE/INACTIVE).
export default function ChannelStatusForm({ id, status }: { id: string; status: string }) {
  const boundAction = updateNotificationChannelStatus.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex items-end gap-2 border-t border-border pt-2 text-[11px]">
      {state.error && <span className="text-danger">{state.error}</span>}
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
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto px-2 py-1">
      {pending ? 'Čuvanje…' : 'sačuvaj'}
    </Button>
  );
}
