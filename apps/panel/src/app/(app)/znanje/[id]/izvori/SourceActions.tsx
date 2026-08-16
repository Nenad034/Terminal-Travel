'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { reviewSource, FormState } from '../../actions';

const initialState: FormState = { error: null };

// M23 spec §2.3/§4b/§8 — POST .../sources/:sourceId/approve|reject, zahteva
// M23/article-source/APPROVE, nikad AI (assertHumanActor sprovodi na nivou koda).
export default function SourceActions({ articleId, sourceId }: { articleId: string; sourceId: string }) {
  const approveAction = reviewSource.bind(null, articleId, sourceId, 'approve');
  const rejectAction = reviewSource.bind(null, articleId, sourceId, 'reject');
  const [approveState, approveFormAction] = useFormState(approveAction, initialState);
  const [rejectState, rejectFormAction] = useFormState(rejectAction, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
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
      {pending ? 'Odobravam…' : 'odobri'}
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
