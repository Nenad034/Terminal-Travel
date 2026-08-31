'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { publishArticle, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M21 spec §2.1/§3/§8 — PUBLISH je isključivo Direktor/Vlasnik (potvrđena odluka vlasnika, dvoslojni
// obrazac kao M12 ContentPiece.APPROVE_PUBLISH). Nepovratna granica, sopstveno dugme, nikad deo
// druge forme (isti princip kao M12 ApproveContentButton). Backend automatski popunjava approved_by
// sa pozivaocem — nikad se ne šalje kroz telo, nikad AI.
export default function PublishButton({ id }: { id: string }) {
  const boundAction = publishArticle.bind(null, id);
  const [state, formAction] = useActionState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <Btn />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Objavljujem…' : 'objavi (nepovratno)'}
    </Button>
  );
}
