'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { reviewSource, FormState } from '../../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M23 spec §2.3/§4b/§8 — POST .../sources/:sourceId/approve|reject, zahteva
// M23/article-source/APPROVE, nikad AI (assertHumanActor sprovodi na nivou koda).
export default function SourceActions({ articleId, sourceId }: { articleId: string; sourceId: string }) {
  const approveAction = reviewSource.bind(null, articleId, sourceId, 'approve');
  const rejectAction = reviewSource.bind(null, articleId, sourceId, 'reject');
  const [approveState, approveFormAction] = useActionState(approveAction, initialState);
  const [rejectState, rejectFormAction] = useActionState(rejectAction, initialState);

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
    <Button type="submit" disabled={pending} size="sm">
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
