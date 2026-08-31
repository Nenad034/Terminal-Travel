'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { updateUser, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

export default function EditUserForm({ id, fullName, phone }: { id: string; fullName: string; phone: string | null }) {
  const boundAction = updateUser.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <label className="text-xs text-ink-faint">
        ime i prezime
        <input name="fullName" defaultValue={fullName} required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        telefon
        <input name="phone" defaultValue={phone ?? ''} className="input mt-1" />
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Čuvanje…' : 'Sačuvaj'}
    </Button>
  );
}
