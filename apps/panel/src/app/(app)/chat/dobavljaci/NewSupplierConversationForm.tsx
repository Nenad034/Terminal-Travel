'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import Icon from '@/components/Icon';
import { createSupplierConversation, FormState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M19 spec §9.3/§9.7 — POST /chat/conversations (type=EXTERNAL_SUPPLIER). Prikazuje se samo uz
// M19/supplier-conversation/GRANT_ACCESS (page.tsx) — kreiranje ODMAH daje tvorcu pristup
// (self-grant, ConversationsService.create komentar), pa je isti krug dozvola dovoljan.
export default function NewSupplierConversationForm({ suppliers }: { suppliers: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(createSupplierConversation, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} size="sm" className="flex items-center gap-1.5">
        <Icon name="add" /> novi razgovor sa dobavljačem
      </Button>
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
        <Button type="button" onClick={() => setOpen(false)} variant="ghost" size="sm">
          otkaži
        </Button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Kreiranje…' : 'kreiraj razgovor'}
    </Button>
  );
}
