'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  upsertEmployeeRecord,
  upsertLeaveEntitlement,
  createLeaveRecord,
  approveLeaveRecord,
  rejectLeaveRecord,
  type FormState,
} from './hr-actions';
import { Badge } from '@/components/ui/badge';
import DateField from '@/components/DateField';

interface EmployeeRecord {
  employmentType: 'PUNO_RADNO_VREME' | 'NEPUNO_RADNO_VREME' | 'UGOVOR_O_DELU';
  contractBasis: 'NEODREDJENO' | 'ODREDJENO';
  hireDate: string;
  probationEndDate: string | null;
  contractEndDate: string | null;
  terminationDate: string | null;
  reportsToUserId: string | null;
}

// M24 spec §2.2a (predlog v1.5) — dodeljeni dani godišnjeg odmora PO GODINI, zamenjuje raniji
// flat EmployeeRecord.annualLeaveDaysEntitled. carriedOverDays/carriedOverExpiresAt su
// predložena/ručno potvrđena vrednost (Zakon o radu RS: rok 30.6.) — sistem ih ne sprovodi sam.
interface LeaveEntitlement {
  id: string;
  year: number;
  daysEntitled: number;
  carriedOverDays: number | null;
  carriedOverExpiresAt: string | null;
}

interface LeaveRecord {
  id: string;
  type: 'GODISNJI_ODMOR' | 'BOLOVANJE' | 'NEPLACENO_ODSUSTVO' | 'OSTALO';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  startDate: string;
  endDate: string;
  daysCount: number;
  note: string | null;
  rejectionReason: string | null;
}

interface LeaveBalance {
  entitled: number | null;
  used: number;
  remaining: number | null;
}

const LEAVE_TYPE_LABEL: Record<LeaveRecord['type'], string> = {
  GODISNJI_ODMOR: 'Godišnji odmor',
  BOLOVANJE: 'Bolovanje',
  NEPLACENO_ODSUSTVO: 'Neplaćeno odsustvo',
  OSTALO: 'Ostalo',
};

const toInputDate = (v: string | null) => (v ? v.slice(0, 10) : '');

// M24 spec §6 — HR ekran, na `/korisnici/[id]` (odluka pri implementaciji: isti ekran gde se već
// uređuje profil/uloge, umesto novog zasebnog mesta u podešavanjima). Dopunjeno §3a (8.9.2026)
// — zahtev/odobrenje odsustva, zamenjuje mejl prepisku.
export default function HrSection({
  userId,
  canEdit,
  canRequestLeave,
  canApprove,
  employee,
  leaveRecords,
  leaveBalance,
  leaveEntitlements,
}: {
  userId: string;
  canEdit: boolean;
  canRequestLeave: boolean;
  canApprove: boolean;
  employee: EmployeeRecord | null;
  leaveRecords: LeaveRecord[];
  leaveBalance: LeaveBalance;
  leaveEntitlements: LeaveEntitlement[];
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">HR dosije</h2>

      {canEdit ? (
        <EmployeeRecordForm userId={userId} employee={employee} />
      ) : employee ? (
        <ReadOnlyEmployeeRecord employee={employee} />
      ) : (
        <p className="text-xs text-ink-faint">HR dosije još nije popunjen.</p>
      )}

      {employee && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="font-medium text-ink">Godišnji odmor</span>
              <a href="/kalendar-odsustava" className="text-accent-strong hover:underline">
                prikaži kalendar
              </a>
            </span>
            {leaveBalance.entitled != null ? (
              <span className="text-ink-dim">
                preostalo {leaveBalance.remaining} od {leaveBalance.entitled} dana
              </span>
            ) : (
              <span className="text-ink-faint">
                nije dodeljen broj dana za {new Date().getFullYear()}.
              </span>
            )}
          </div>

          <LeaveEntitlementsList entitlements={leaveEntitlements} />
          {canEdit && <LeaveEntitlementForm userId={userId} />}

          {leaveRecords.length === 0 ? (
            <p className="text-xs text-ink-faint">Nema evidentiranih odsustava.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5">
              {leaveRecords.map((l) => (
                <LeaveRow key={l.id} userId={userId} leave={l} canApprove={canApprove} />
              ))}
            </ul>
          )}

          {canRequestLeave && <LeaveRecordForm userId={userId} />}
        </div>
      )}
    </div>
  );
}

// M24 spec §2.2a (predlog v1.5) — dodeljeni dani PO GODINI, lista umesto jednog fiksnog polja.
function LeaveEntitlementsList({ entitlements }: { entitlements: LeaveEntitlement[] }) {
  if (entitlements.length === 0) return null;
  return (
    <ul className="mb-2 flex flex-col gap-1 text-xs">
      {entitlements.map((e) => (
        <li key={e.id} className="flex items-center gap-2 text-ink-dim">
          <Badge variant="secondary">{e.year}.</Badge>
          <span>{e.daysEntitled} dana</span>
          {e.carriedOverDays != null && (
            <span className="text-ink-faint">
              + {e.carriedOverDays} preneto
              {e.carriedOverExpiresAt && ` (rok ${toInputDate(e.carriedOverExpiresAt)})`}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function LeaveEntitlementForm({ userId }: { userId: string }) {
  const initialState: FormState = { error: null };
  const boundAction = upsertLeaveEntitlement.bind(null, userId);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form
      action={formAction}
      className="mb-3 flex flex-wrap items-end gap-2 border-b border-border pb-3 text-xs"
    >
      {state.error && <p className="w-full rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
      <label className="text-ink-faint">
        godina
        <input
          type="number"
          name="year"
          required
          defaultValue={new Date().getFullYear()}
          className="input mt-1 w-20"
        />
      </label>
      <label className="text-ink-faint">
        dodeljeno dana
        <input type="number" min={0} name="daysEntitled" required className="input mt-1 w-24" />
      </label>
      <label className="text-ink-faint">
        preneto iz prethodne
        <input type="number" min={0} name="carriedOverDays" className="input mt-1 w-24" />
      </label>
      <label className="text-ink-faint">
        rok za preneto
        <div className="mt-1">
          <DateField name="carriedOverExpiresAt" />
        </div>
      </label>
      <EntitlementSaveButton />
    </form>
  );
}

function EntitlementSaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded px-2 py-1.5 font-medium text-accent-strong hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? 'Čuvam…' : '+ dodaj/izmeni godinu'}
    </button>
  );
}

function LeaveRow({
  userId,
  leave,
  canApprove,
}: {
  userId: string;
  leave: LeaveRecord;
  canApprove: boolean;
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-border pb-1.5 text-xs last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <span>
          <Badge variant="secondary">{LEAVE_TYPE_LABEL[leave.type]}</Badge>{' '}
          {toInputDate(leave.startDate)} – {toInputDate(leave.endDate)}
        </span>
        <span className="flex items-center gap-2">
          <StatusBadge status={leave.status} />
          <span className="text-ink-faint">{leave.daysCount} dana</span>
        </span>
      </div>
      {leave.status === 'REJECTED' && leave.rejectionReason && (
        <p className="text-danger">razlog: {leave.rejectionReason}</p>
      )}
      {leave.status === 'PENDING' && canApprove && (
        <LeaveDecisionActions userId={userId} leaveId={leave.id} />
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: LeaveRecord['status'] }) {
  if (status === 'APPROVED') return <Badge variant="ok">odobreno</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger">odbijeno</Badge>;
  return <Badge variant="warn">čeka odobrenje</Badge>;
}

function LeaveDecisionActions({ userId, leaveId }: { userId: string; leaveId: string }) {
  const approveInitial: FormState = { error: null };
  const boundApprove = approveLeaveRecord.bind(null, userId, leaveId);
  const [approveState, approveAction] = useActionState(boundApprove, approveInitial);

  const rejectInitial: FormState = { error: null };
  const boundReject = rejectLeaveRecord.bind(null, userId, leaveId);
  const [rejectState, rejectAction] = useActionState(boundReject, rejectInitial);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={approveAction}>
        <ApproveButton />
      </form>
      <form action={rejectAction} className="flex items-center gap-1.5">
        <input
          name="reason"
          placeholder="razlog odbijanja"
          required
          className="input h-6 w-40 text-[11px]"
        />
        <RejectButton />
      </form>
      {(approveState.error || rejectState.error) && (
        <span className="text-danger">{approveState.error ?? rejectState.error}</span>
      )}
    </div>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-ok-bg px-2 py-1 font-medium text-ok hover:brightness-95 disabled:opacity-50"
    >
      {pending ? 'Odobravam…' : 'Odobri'}
    </button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-danger-bg px-2 py-1 font-medium text-danger hover:brightness-95 disabled:opacity-50"
    >
      {pending ? 'Odbijam…' : 'Odbij'}
    </button>
  );
}

function EmployeeRecordForm({
  userId,
  employee,
}: {
  userId: string;
  employee: EmployeeRecord | null;
}) {
  const initialState: FormState = { error: null };
  const boundAction = upsertEmployeeRecord.bind(null, userId);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 text-xs">
      {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-ink-faint">
          tip zaposlenja
          <select
            name="employmentType"
            defaultValue={employee?.employmentType ?? 'PUNO_RADNO_VREME'}
            className="input mt-1"
          >
            <option value="PUNO_RADNO_VREME">puno radno vreme</option>
            <option value="NEPUNO_RADNO_VREME">nepuno radno vreme</option>
            <option value="UGOVOR_O_DELU">ugovor o delu</option>
          </select>
        </label>
        <label className="text-ink-faint">
          ugovor
          <select
            name="contractBasis"
            defaultValue={employee?.contractBasis ?? 'NEODREDJENO'}
            className="input mt-1"
          >
            <option value="NEODREDJENO">na neodređeno</option>
            <option value="ODREDJENO">na određeno</option>
          </select>
        </label>
        <label className="text-ink-faint">
          datum zasnivanja *
          <div className="mt-1">
            <DateField
              name="hireDate"
              defaultValue={toInputDate(employee?.hireDate ?? null)}
              required
            />
          </div>
        </label>
        <label className="text-ink-faint">
          kraj probnog rada
          <div className="mt-1">
            <DateField
              name="probationEndDate"
              defaultValue={toInputDate(employee?.probationEndDate ?? null)}
            />
          </div>
        </label>
        <label className="text-ink-faint">
          istek ugovora (na određeno)
          <div className="mt-1">
            <DateField
              name="contractEndDate"
              defaultValue={toInputDate(employee?.contractEndDate ?? null)}
            />
          </div>
        </label>
        <label className="text-ink-faint">
          prestanak radnog odnosa
          <div className="mt-1">
            <DateField
              name="terminationDate"
              defaultValue={toInputDate(employee?.terminationDate ?? null)}
            />
          </div>
        </label>
        <label className="text-ink-faint">
          neposredni rukovodilac (ID korisnika)
          <input
            name="reportsToUserId"
            defaultValue={employee?.reportsToUserId ?? ''}
            placeholder="odobrava zahteve za odsustvo"
            className="input mt-1"
          />
        </label>
      </div>
      <SubmitButton />
    </form>
  );
}

function ReadOnlyEmployeeRecord({ employee }: { employee: EmployeeRecord }) {
  return (
    <dl className="grid gap-2 text-xs sm:grid-cols-2">
      <div>
        <dt className="text-ink-faint">datum zasnivanja</dt>
        <dd className="text-ink">{toInputDate(employee.hireDate)}</dd>
      </div>
      <div>
        <dt className="text-ink-faint">ugovor</dt>
        <dd className="text-ink">
          {employee.contractBasis === 'ODREDJENO' ? 'na određeno' : 'na neodređeno'}
        </dd>
      </div>
    </dl>
  );
}

function LeaveRecordForm({ userId }: { userId: string }) {
  const initialState: FormState = { error: null };
  const boundAction = createLeaveRecord.bind(null, userId);
  const [state, formAction] = useActionState(boundAction, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2 border-t border-border pt-3 text-xs"
    >
      {state.error && <p className="w-full rounded bg-danger-bg p-2 text-danger">{state.error}</p>}
      <label className="text-ink-faint">
        tip
        <select name="type" defaultValue="GODISNJI_ODMOR" className="input mt-1">
          <option value="GODISNJI_ODMOR">godišnji odmor</option>
          <option value="BOLOVANJE">bolovanje</option>
          <option value="NEPLACENO_ODSUSTVO">neplaćeno odsustvo</option>
          <option value="OSTALO">ostalo</option>
        </select>
      </label>
      <label className="text-ink-faint">
        od
        <div className="mt-1">
          <DateField name="startDate" required />
        </div>
      </label>
      <label className="text-ink-faint">
        do
        <div className="mt-1">
          <DateField name="endDate" required />
        </div>
      </label>
      <label className="text-ink-faint">
        dana
        <div className="mt-1">
          <input type="number" min={1} name="daysCount" required className="input w-16" />
        </div>
      </label>
      <label className="text-ink-faint">
        napomena
        <input name="note" className="input mt-1" />
      </label>
      <AddButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-brand px-3 py-1.5 font-medium text-brand-ink hover:brightness-90 disabled:opacity-50"
    >
      {pending ? 'Čuvam…' : 'Sačuvaj'}
    </button>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded px-2 py-1.5 font-medium text-accent-strong hover:bg-accent-soft disabled:opacity-50"
    >
      {pending ? 'Šaljem…' : '+ zatraži odsustvo'}
    </button>
  );
}
