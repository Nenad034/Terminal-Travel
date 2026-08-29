'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { approveRebate, rejectRebate, FormState } from './actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// M7 spec §3.2 — approve() je "obavezno ljudski nalog — direktan uticaj na novac", i M15
// registar (seed.ts) klasifikuje commission_rebate.apply kao PROPOSE_THEN_APPROVE — ova dugmad
// su namerno sopstvena forma, ne deo nijedne druge radnje/toka (isti princip kao M10
// "Potvrdi i pošalji fakturu").
export default function RebateActions({ subagentId, rebateId }: { subagentId: string; rebateId: string }) {
  const [showReject, setShowReject] = useState(false);
  const boundApprove = approveRebate.bind(null, subagentId, rebateId);
  const boundReject = rejectRebate.bind(null, subagentId, rebateId);
  const [approveState, approveAction] = useFormState(boundApprove, initialState);
  const [rejectState, rejectAction] = useFormState(boundReject, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={approveAction}>
          <ApproveButton />
        </form>
        {!showReject ? (
          <Button type="button" onClick={() => setShowReject(true)} variant="destructive" size="sm">
            odbij
          </Button>
        ) : null}
      </div>
      {showReject && (
        <form action={rejectAction} className="flex items-center gap-2">
          <input name="reason" required placeholder="razlog odbijanja" className="input w-48" />
          <RejectButton />
        </form>
      )}
      {approveState.error && <span className="text-[11px] text-danger">{approveState.error}</span>}
      {rejectState.error && <span className="text-[11px] text-danger">{rejectState.error}</span>}
    </div>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Odobravam…' : 'odobri rabat'}
    </Button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="destructive" size="sm">
      {pending ? 'Odbijam…' : 'potvrdi odbijanje'}
    </Button>
  );
}
