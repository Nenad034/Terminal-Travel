'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runWeeklyReview, FormState } from './actions';
import { Button } from '@/components/ui/button';

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
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="h-auto px-2 py-1 text-[11px]">
      {pending ? 'Pokrećem…' : 'pokreni ručno'}
    </Button>
  );
}
