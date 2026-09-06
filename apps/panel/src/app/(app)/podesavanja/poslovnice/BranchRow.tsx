'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateBranch, type FormState } from './actions';

const initialState: FormState = { error: null };

// M1 spec dopuna (6.9.2026) — jedan red = jedna nezavisna forma (PATCH /iam/branches/:id), isti
// princip kao ostali inline-editable redovi u panelu (npr. RoleAssignment) — nema odvojenog
// "režima izmene", polje je uvek uređivano, čuva se na klik.
export default function BranchRow({ id, name, active }: { id: string; name: string; active: boolean }) {
  const boundAction = updateBranch.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex items-center gap-3 border-b border-border py-2 text-xs last:border-0">
      <input name="name" defaultValue={name} required className="input flex-1" />
      <label className="flex items-center gap-1.5 text-ink-dim">
        <input type="checkbox" name="active" defaultChecked={active} className="h-3.5 w-3.5" />
        aktivna
      </label>
      <SaveButton />
      {state.error && <span className="text-danger">{state.error}</span>}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded px-2 py-1 font-medium text-accent-strong hover:bg-accent-soft disabled:opacity-50">
      {pending ? 'Čuvam…' : 'Sačuvaj'}
    </button>
  );
}
