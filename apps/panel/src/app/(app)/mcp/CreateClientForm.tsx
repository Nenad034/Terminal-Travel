'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { createMcpClient, FormState } from './actions';

const initialState: FormState = { error: null };

// M16 spec §3.1 — plaintext kredencijal se vraća tačno jednom, ovde. Prikazan dok se forma ne
// zatvori/osveži — posle toga nema načina da se ponovo prikaže (isti obrazac kao izdavanje API
// ključa), zato ostaje u ovom klijentskom stanju, ne u bazi.
export default function CreateClientForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createMcpClient, initialState);

  if (state.credential) {
    return (
      <div className="mb-4 rounded-lg border border-ok bg-ok-bg p-4 text-sm">
        <p className="font-semibold text-ink">
          Klijent „{state.clientName}" registrovan. Sačuvajte kredencijal — prikazuje se samo ovaj put:
        </p>
        <code className="mt-2 block break-all rounded bg-panel px-2 py-1.5 text-xs text-ink">{state.credential}</code>
        <button
          onClick={() => setOpen(false)}
          className="mt-3 rounded border border-border bg-panel px-2 py-1 text-[11px] font-medium text-ink-dim hover:border-accent"
        >
          Zatvori
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong"
      >
        <Icon name="add" /> registruj MCP klijenta
      </button>
    );
  }

  return (
    <form action={formAction} className="mb-4 rounded-lg border border-border bg-panel p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-ink-dim">
          Naziv klijenta
          <input
            name="clientName"
            required
            placeholder="npr. ChatGPT (OpenAI)"
            className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="text-xs text-ink-dim">
          Rate limit (poziva/min, podrazumevano 60)
          <input
            name="rateLimitPerMinute"
            type="number"
            min={1}
            placeholder="60"
            className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm text-ink"
          />
        </label>
      </div>
      {state.error && <p className="mt-2 text-[11px] text-danger">{state.error}</p>}
      <div className="mt-3 flex gap-2">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-border bg-panel px-3 py-1.5 text-xs text-ink-dim hover:border-accent"
        >
          Otkaži
        </button>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Novi klijent počinje kao PENDING/READ_ONLY (M16 spec §3.1) — aktivacija i prelazak na READ_WRITE su odvojeni,
        ručni koraci ispod.
      </p>
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
      {pending ? 'Registrujem…' : 'Registruj'}
    </button>
  );
}
