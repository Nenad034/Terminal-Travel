'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { acceptContract, voidContract, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

export function AcceptButton({ id }: { id: string }) {
  const boundAction = acceptContract.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Evidentiraj prihvatanje (skenirani potpis)" pendingLabel="Beležim…" tone="accent" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export function VoidButton({ id }: { id: string }) {
  const boundAction = voidContract.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);
  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <Btn label="Poništi ugovor" pendingLabel="Poništavam…" tone="danger" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn({ label, pendingLabel, tone }: { label: string; pendingLabel: string; tone: 'accent' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant={tone === 'accent' ? 'default' : 'destructive'} size="sm">
      {pending ? pendingLabel : label}
    </Button>
  );
}
