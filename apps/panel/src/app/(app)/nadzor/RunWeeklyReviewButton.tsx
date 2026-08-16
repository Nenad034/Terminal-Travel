'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runWeeklyReview, FormState } from './actions';

const initialState: FormState = { error: null };

// M18 spec §4.1/§9 — POST /ops/weekly-reviews/run, ručno pokretanje van nedeljnog rasporeda
// (isti sažetak kao ponedeljni cron @Cron('0 8 * * 1')).
export default function RunWeeklyReviewButton() {
  const [state, formAction] = useFormState(runWeeklyReview, initialState);
  return (
    <form action={formAction} className="flex items-center gap-2">
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-border bg-panel px-2 py-1 text-[11px] font-medium text-ink-dim hover:border-accent disabled:opacity-50"
    >
      {pending ? 'Pokrećem…' : 'pokreni ručno'}
    </button>
  );
}
