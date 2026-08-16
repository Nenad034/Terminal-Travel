'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { grantMailboxAccess, FormState } from '../actions';

const initialState: FormState = { error: null };

// M22 spec §2.2/§8 — POST /email/mailboxes/:id/access, zahteva M22/mailbox-access/GRANT (page.tsx
// gate). Pristup se NIKAD ne izvodi iz opšte uloge — svaki zaposleni mora biti eksplicitno dodat.
export default function GrantAccessForm({ mailboxId }: { mailboxId: string }) {
  const boundAction = grantMailboxAccess.bind(null, mailboxId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      {state.error && <p className="w-full rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <label className="text-[11px] text-ink-faint">
        korisnik (M1 User UUID)
        <input name="userId" required className="input mt-1" placeholder="UUID" />
      </label>
      <label className="text-[11px] text-ink-faint">
        nivo
        <select name="accessLevel" className="input mt-1">
          <option value="VIEW">VIEW</option>
          <option value="REPLY">REPLY</option>
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
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Dodeljivanje…' : 'dodeli pristup'}
    </button>
  );
}
