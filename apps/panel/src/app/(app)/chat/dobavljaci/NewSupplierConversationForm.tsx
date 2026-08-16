'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { createSupplierConversation, FormState } from './actions';

const initialState: FormState = { error: null };

// M19 spec §9.3/§9.7 — POST /chat/conversations (type=EXTERNAL_SUPPLIER). Prikazuje se samo uz
// M19/supplier-conversation/GRANT_ACCESS (page.tsx) — kreiranje ODMAH daje tvorcu pristup
// (self-grant, ConversationsService.create komentar), pa je isti krug dozvola dovoljan.
export default function NewSupplierConversationForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createSupplierConversation, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
      >
        <Icon name="add" /> novi razgovor sa dobavljačem
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      {state.error && <p className="rounded bg-danger-bg p-2 text-xs text-danger">{state.error}</p>}
      <label className="text-xs text-ink-faint">
        dobavljač
        <select name="supplierId" required className="input mt-1">
          <option value="">— izaberite —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
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
