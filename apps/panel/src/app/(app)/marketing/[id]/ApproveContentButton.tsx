'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { approveContent, FormState } from '../actions';

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
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Odobravam…' : 'odobri (nepovratno, javna objava)'}
    </button>
  );
}
