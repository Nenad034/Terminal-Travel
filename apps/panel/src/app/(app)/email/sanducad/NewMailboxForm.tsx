'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { createMailbox, FormState } from '../actions';

const initialState: FormState = { error: null };

// M22 spec §2.1 — POST /email/mailboxes, zahteva M22/mailbox/CREATE (page.tsx gate). PERSONAL
// zahteva ownerUserId (backend auto-upisuje REPLY vlasniku, §2.2); SHARED ga ne sme imati —
// validacija je u backend DTO/servisu, ovaj obrazac je isti kao M19 NewSupplierConversationForm.
export default function NewMailboxForm() {
  const [state, formAction] = useFormState(createMailbox, initialState);
  const [open, setOpen] = useState(false);
  const [mailboxType, setMailboxType] = useState<'SHARED' | 'PERSONAL'>('SHARED');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
      >
        <Icon name="add" /> novo sanduče
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
      {state.error && <p className="rounded bg-danger-bg p-2 text-xs text-danger">{state.error}</p>}
      <label className="text-xs text-ink-faint">
        mejl adresa
        <input name="address" type="email" required className="input mt-1" placeholder="rezervacije@terminal-travel.rs" />
      </label>
      <label className="text-xs text-ink-faint">
        naziv
        <input name="displayName" required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        tip
        <select name="mailboxType" className="input mt-1" value={mailboxType} onChange={(e) => setMailboxType(e.target.value as 'SHARED' | 'PERSONAL')}>
          <option value="SHARED">SHARED (deljeno)</option>
          <option value="PERSONAL">PERSONAL (lično)</option>
        </select>
      </label>
      {mailboxType === 'PERSONAL' && (
        <label className="text-xs text-ink-faint">
          vlasnik (M1 User UUID)
          <input name="ownerUserId" required className="input mt-1" placeholder="UUID" />
        </label>
      )}
      <label className="text-xs text-ink-faint">
        provider connection ref
        <input name="providerConnectionRef" defaultValue="mock" className="input mt-1" />
      </label>
      <label className="flex items-center gap-2 text-[11px] text-ink-dim">
        <input type="checkbox" name="isSupplierUnifiedInbox" className="h-3.5 w-3.5" />
        jedinstveno sanduče za dobavljače (M5 §8.8, najviše jedno sme biti obeleženo)
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
      className="self-start rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Kreiranje…' : 'kreiraj sanduče'}
    </button>
  );
}
