'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createBranch, type FormState } from './actions';

const initialState: FormState = { error: null };

export default function NewBranchForm() {
  const [state, formAction] = useActionState(createBranch, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2 text-xs">
      {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
      <input name="name" placeholder="naziv nove poslovnice" required className="input flex-1" />
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded bg-brand px-3 py-1.5 font-medium text-brand-ink hover:brightness-90 disabled:opacity-50">
      {pending ? 'Dodajem…' : 'Dodaj poslovnicu'}
    </button>
  );
}
