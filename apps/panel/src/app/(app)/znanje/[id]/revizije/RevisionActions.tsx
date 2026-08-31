'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { reviewRevision, FormState } from '../../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M23 spec §2.4/§4c/§9 — POST .../revisions/:revisionId/approve|reject, zahteva
// M23/article-revision/APPROVE, nikad AI. Backend odbija approve (400) ako bilo koji referenciran
// ArticleSource nije APPROVED (§9 izlazni kriterijum) — poruka greške dolazi odatle, ova
// komponenta je samo prosleđuje.
export default function RevisionActions({ articleId, revisionId, disabled }: { articleId: string; revisionId: string; disabled?: boolean }) {
  const approveAction = reviewRevision.bind(null, articleId, revisionId, 'approve');
  const rejectAction = reviewRevision.bind(null, articleId, revisionId, 'reject');
  const [approveState, approveFormAction] = useActionState(approveAction, initialState);
  const [rejectState, rejectFormAction] = useActionState(rejectAction, initialState);

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
    <Button
      type="submit"
      disabled={pending || disabled}
      title={disabled ? 'Svi referencirani izvori moraju biti APPROVED pre odobrenja revizije (§4b/§9).' : undefined}
      size="sm"
    >
      {pending ? 'Odobravam…' : 'odobri'}
    </Button>
  );
}

function RejectBtn() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="outline" size="sm" className="hover:border-danger hover:text-danger">
      {pending ? 'Odbijam…' : 'odbij'}
    </Button>
  );
}
