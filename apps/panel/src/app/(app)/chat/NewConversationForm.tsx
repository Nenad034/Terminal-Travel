'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { createConversation, FormState } from './actions';

const initialState: FormState = { error: null };

interface StaffUser {
  id: string;
  fullName: string;
  accountType: string;
  status: string;
}

// M19 spec §2.1/§8 — POST /chat/conversations, samo DIRECT/GROUP (EXTERNAL_SUPPLIER ima
// sopstvenu formu na /chat/dobavljaci, §9). Prikazuje se samo kad je pozivalac dobio
// M19/conversation/CREATE i backend vratio listu STAFF korisnika (page.tsx) — ako nema
// M1/user/VIEW za listu, ova forma se ne renderuje uopšte (nema odakle birati učesnike).
export default function NewConversationForm({ staffUsers }: { staffUsers: StaffUser[] }) {
  const [state, formAction] = useFormState(createConversation, initialState);
  const [type, setType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
      >
        <Icon name="add" /> novi razgovor
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      {state.error && <p className="rounded bg-danger-bg p-2 text-xs text-danger">{state.error}</p>}

      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="radio" name="type" value="DIRECT" checked={type === 'DIRECT'} onChange={() => setType('DIRECT')} /> direktna poruka
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="type" value="GROUP" checked={type === 'GROUP'} onChange={() => setType('GROUP')} /> grupa
        </label>
      </div>

      {type === 'GROUP' && (
        <label className="text-xs text-ink-faint">
          naziv grupe
          <input name="name" required className="input mt-1" />
        </label>
      )}

      <div className="max-h-40 overflow-y-auto rounded border border-border p-2 text-xs">
        {staffUsers.length === 0 && <p className="text-ink-faint">Nema drugih dostupnih korisnika.</p>}
        {staffUsers.map((u) => (
          <label key={u.id} className="flex items-center gap-2 py-1">
            <input type={type === 'DIRECT' ? 'radio' : 'checkbox'} name="participantUserIds" value={u.id} required />
            {u.fullName}
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <SubmitButton />
        <button type="button" onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink">
          otkaži
        </button>
      </div>
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
      {pending ? 'Kreiranje…' : 'kreiraj razgovor'}
    </button>
  );
}
