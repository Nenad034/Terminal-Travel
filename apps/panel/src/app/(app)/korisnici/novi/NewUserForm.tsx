'use client';

import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useActionState } from 'react';
import { inviteUser, InviteState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: InviteState = { error: null };

// M1 spec §7 — POST /iam/users, kreira nalog u statusu INVITED (nema lozinku dok pozvani
// korisnik ne postavi svoju preko linka za aktivaciju).
//
// Dopuna 4.9.2026: slanje email-a još nije povezano, pa se link posle kreiranja PRIKAZUJE
// ovde da ga pozivalac prosledi ručno (isti obrazac kao M19 pozivnica dobavljaču). Ranije
// je token tiho nestajao i pozvani čovek nikad nije mogao da se prijavi.
export default function NewUserForm({ roles }: { roles: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(inviteUser, initialState);

  if (state.inviteToken && state.userId) {
    const link = `${typeof window === 'undefined' ? '' : window.location.origin}/aktivacija?token=${state.inviteToken}`;
    return (
      <div className="flex max-w-lg flex-col gap-3 rounded-lg border border-border bg-panel p-5">
        <p className="rounded bg-ok-bg p-3 text-sm text-ok">
          {state.emailDelivered
            ? 'Nalog je napravljen, a pozivnica poslata na njegovu email adresu.'
            : 'Nalog je napravljen i čeka aktivaciju.'}
        </p>
        <div>
          <p className="text-xs text-ink-faint">
            {state.emailDelivered
              ? 'Isti link je ispod — pri ruci ako poruka ne stigne (spam filter, pogrešna adresa). Važi 48 sati i koristi se jednom.'
              : 'Poruka NIJE poslata (slanje pošte nije podešeno ili server nije odgovorio) — prosledite ovaj link kolegi sami. Važi 48 sati i koristi se jednom.'}
          </p>
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="input mt-2 w-full font-mono text-xs"
          />
        </div>
        <div className="flex gap-3">
          <Link href={`/korisnici/${state.userId}`} className="text-xs text-accent underline">
            otvori nalog
          </Link>
          <Link href="/korisnici/novi" className="text-xs text-ink-faint hover:text-ink">
            pozovi još jednog
          </Link>
        </div>
      </div>
    );
  }

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
