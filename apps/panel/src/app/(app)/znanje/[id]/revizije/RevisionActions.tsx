'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { reviewRevision, FormState } from '../../actions';

const initialState: FormState = { error: null };

// M23 spec §2.4/§4c/§9 — POST .../revisions/:revisionId/approve|reject, zahteva
// M23/article-revision/APPROVE, nikad AI. Backend odbija approve (400) ako bilo koji referenciran
// ArticleSource nije APPROVED (§9 izlazni kriterijum) — poruka greške dolazi odatle, ova
// komponenta je samo prosleđuje.
export default function RevisionActions({ articleId, revisionId, disabled }: { articleId: string; revisionId: string; disabled?: boolean }) {
  const approveAction = reviewRevision.bind(null, articleId, revisionId, 'approve');
  const rejectAction = reviewRevision.bind(null, articleId, revisionId, 'reject');
  const [approveState, approveFormAction] = useFormState(approveAction, initialState);
  const [rejectState, rejectFormAction] = useFormState(rejectAction, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={approveFormAction}>
          <ApproveBtn disabled={disabled} />
        </form>
        <form action={rejectFormAction}>
          <RejectBtn />
        </form>
      </div>
      {approveState.error && <span className="max-w-xs text-right text-[11px] text-danger">{approveState.error}</span>}
      {rejectState.error && <span className="max-w-xs text-right text-[11px] text-danger">{rejectState.error}</span>}
    </div>
  );
}

function ApproveBtn({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      title={disabled ? 'Svi referencirani izvori moraju biti APPROVED pre odobrenja revizije (§4b/§9).' : undefined}
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
