'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { approveTrendSuggestion, rejectTrendSuggestion, FormState } from '../actions';

const initialState: FormState = { error: null };

// M18 spec §5.1/§9 — POST /ops/trend-suggestions/:id/approve i /reject, dozvola
// M18/trend-suggestion/APPROVE. Dva odvojena dugmeta/forme, isti princip kao M7 RebateActions
// ("odobri"/"odbij" nikad deo iste forme).
export default function TrendSuggestionActions({ id }: { id: string }) {
  const boundApprove = approveTrendSuggestion.bind(null, id);
  const boundReject = rejectTrendSuggestion.bind(null, id);
  const [approveState, approveAction] = useFormState(boundApprove, initialState);
  const [rejectState, rejectAction] = useFormState(boundReject, initialState);

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
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Odobravam…' : 'odobri'}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-danger hover:text-danger disabled:opacity-50"
    >
      {pending ? 'Odbijam…' : 'odbij'}
    </button>
  );
}
