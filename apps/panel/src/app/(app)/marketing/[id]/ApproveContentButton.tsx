'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { approveContent, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M12 spec §3 korak 4 — nepovratna granica ka javnoj objavi, nikad AI agent. Sopstveno dugme,
// nikad deo druge forme (isti princip kao M7 RebateActions "odobri rabat").
export default function ApproveContentButton({ id }: { id: string }) {
  const boundAction = approveContent.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
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
      {pending ? 'Odobravam…' : 'odobri (nepovratno, javna objava)'}
    </Button>
  );
}
