'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { suspendUser, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M1 spec §7 — DELETE /iam/users/:id je meko suspendovanje, ne pravo brisanje — svesna,
// potvrđena radnja (dvostepen klik, isti obrazac kao M7 "odbij rabat").
export default function SuspendUserButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const boundAction = suspendUser.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);

  if (!confirming) {
    return (
      <Button type="button" onClick={() => setConfirming(true)} variant="destructive" size="sm">
        Suspenduj nalog
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <p className="text-[11px] text-danger">Ovo odmah opoziva sve aktivne sesije korisnika. Potvrdite:</p>
      <div className="flex gap-2">
        <SubmitButton />
        <Button type="button" onClick={() => setConfirming(false)} variant="ghost" size="sm">
          otkaži
        </Button>
      </div>
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="destructive" size="sm">
      {pending ? 'Suspendujem…' : 'potvrdi suspenziju'}
    </Button>
  );
}
