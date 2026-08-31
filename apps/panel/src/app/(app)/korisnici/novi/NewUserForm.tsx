'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { inviteUser, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M1 spec §7 — POST /iam/users, kreira nalog u statusu INVITED (nema lozinku dok pozvani
// korisnik ne završi sopstvenu registraciju preko inviteToken-a, van obima ovog ekrana).
export default function NewUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(inviteUser, initialState);

  return (
    <form action={formAction} className="flex max-w-lg flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <label className="text-xs text-ink-faint">
        ime i prezime
        <input name="fullName" required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        email
        <input name="email" type="email" required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        telefon (opciono)
        <input name="phone" className="input mt-1" />
      </label>

      <fieldset className="text-xs text-ink-faint">
        <legend className="mb-1">uloge</legend>
        <div className="flex flex-col gap-1.5 rounded border border-border p-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-ink-dim">
              <input type="checkbox" name="roleIds" value={r.id} className="h-3.5 w-3.5" />
              {r.name}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-1 self-start">
      {pending ? 'Šaljem pozivnicu…' : 'Pošalji pozivnicu'}
    </Button>
  );
}
