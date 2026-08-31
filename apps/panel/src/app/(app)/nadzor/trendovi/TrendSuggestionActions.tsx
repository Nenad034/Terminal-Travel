'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { approveTrendSuggestion, rejectTrendSuggestion, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M18 spec §5.1/§9 — POST /ops/trend-suggestions/:id/approve i /reject, dozvola
// M18/trend-suggestion/APPROVE. Dva odvojena dugmeta/forme, isti princip kao M7 RebateActions
// ("odobri"/"odbij" nikad deo iste forme).
export default function TrendSuggestionActions({ id }: { id: string }) {
  const boundApprove = approveTrendSuggestion.bind(null, id);
  const boundReject = rejectTrendSuggestion.bind(null, id);
  const [approveState, approveAction] = useActionState(boundApprove, initialState);
  const [rejectState, rejectAction] = useActionState(boundReject, initialState);

  return (
    <div className="flex items-center gap-2">
      <form action={approveAction}>
        <ApproveButton />
      </form>
      <form action={rejectAction}>
        <RejectButton />
      </form>
      {approveState.error && <span className="text-[11px] text-danger">{approveState.error}</span>}
      {rejectState.error && <span className="text-[11px] text-danger">{rejectState.error}</span>}
    </div>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Odobravam…' : 'odobri'}
    </Button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="hover:border-danger hover:text-danger">
      {pending ? 'Odbijam…' : 'odbij'}
    </Button>
  );
}
