'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { reviewSuggestion, FormState } from '../actions';

const initialState: FormState = { error: null };

// M21 spec §5.4/§6 — PATCH /help/suggestions/:id. APPROVE preusmerava na novi HelpArticle
// (status PENDING_APPROVAL, i dalje čeka sopstvenu objavu); REJECT samo menja status predloga.
export default function SuggestionActions({ id }: { id: string }) {
  const approveAction = reviewSuggestion.bind(null, id, 'APPROVE');
  const rejectAction = reviewSuggestion.bind(null, id, 'REJECT');
  const [approveState, approveFormAction] = useFormState(approveAction, initialState);
  const [rejectState, rejectFormAction] = useFormState(rejectAction, initialState);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <form action={approveFormAction}>
          <ApproveBtn />
        </form>
        <form action={rejectFormAction}>
          <RejectBtn />
        </form>
      </div>
      {approveState.error && <span className="text-[11px] text-danger">{approveState.error}</span>}
      {rejectState.error && <span className="text-[11px] text-danger">{rejectState.error}</span>}
    </div>
  );
}

function ApproveBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Odobravam…' : 'odobri → nacrt članka'}
    </button>
  );
}

function RejectBtn() {
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
