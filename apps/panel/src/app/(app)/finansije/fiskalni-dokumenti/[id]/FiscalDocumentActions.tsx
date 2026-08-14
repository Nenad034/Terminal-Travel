'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitFiscalDocument, stornoFiscalDocument, FormState } from '../../actions';

const initialState: FormState = { error: null };

// M10 spec §6 korak 2 — "Nikad autonomno" (poglavlje 7 Master dokumenta): slanje je nepovratan
// korak (kreira pravni SEF/ESIR dokument) i mora biti eksplicitna radnja u interfejsu, ne
// automatski okidač — ovo dugme je taj eksplicitan, svestan klik.
export function SubmitButton({ id }: { id: string }) {
  const boundAction = submitFiscalDocument.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Btn label="Potvrdi i pošalji fakturu" pendingLabel="Šaljem…" tone="accent" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

export function StornoButton({ id }: { id: string }) {
  const boundAction = stornoFiscalDocument.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Btn label="Storniraj" pendingLabel="Storniram…" tone="danger" />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn({ label, pendingLabel, tone }: { label: string; pendingLabel: string; tone: 'accent' | 'danger' }) {
  const { pending } = useFormStatus();
  const cls = tone === 'accent' ? 'bg-accent text-accent-ink hover:bg-accent-strong' : 'border border-danger text-danger hover:bg-danger-bg';
  return (
    <button type="submit" disabled={pending} className={`rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${cls}`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
