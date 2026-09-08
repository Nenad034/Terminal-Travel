'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { upsertEmployeeRecord, createLeaveRecord, type FormState } from './hr-actions';
import { Badge } from '@/components/ui/badge';

interface EmployeeRecord {
  employmentType: 'PUNO_RADNO_VREME' | 'NEPUNO_RADNO_VREME' | 'UGOVOR_O_DELU';
  contractBasis: 'NEODREDJENO' | 'ODREDJENO';
  hireDate: string;
  probationEndDate: string | null;
  contractEndDate: string | null;
  terminationDate: string | null;
  reportsToUserId: string | null;
  annualLeaveDaysEntitled: number | null;
}

interface LeaveRecord {
  id: string;
  type: 'GODISNJI_ODMOR' | 'BOLOVANJE' | 'NEPLACENO_ODSUSTVO' | 'OSTALO';
  startDate: string;
  endDate: string;
  daysCount: number;
  note: string | null;
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
// uređuje profil/uloge, umesto novog zasebnog mesta u podešavanjima).
export default function HrSection({
  userId,
  canEdit,
  employee,
  leaveRecords,
  leaveBalance,
}: {
  userId: string;
  canEdit: boolean;
  employee: EmployeeRecord | null;
  leaveRecords: LeaveRecord[];
  leaveBalance: LeaveBalance;
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
            <span className="font-medium text-ink">Godišnji odmor</span>
            {leaveBalance.entitled != null ? (
              <span className="text-ink-dim">
                preostalo {leaveBalance.remaining} od {leaveBalance.entitled} dana
              </span>
            ) : (
              <span className="text-ink-faint">nije dodeljen broj dana</span>
            )}
          </div>

          {leaveRecords.length === 0 ? (
            <p className="text-xs text-ink-faint">Nema evidentiranih odsustava.</p>
          ) : (
            <ul className="mb-3 flex flex-col gap-1.5">
              {leaveRecords.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs">
                  <span>
                    <Badge variant="secondary">{LEAVE_TYPE_LABEL[l.type]}</Badge>{' '}
                    {toInputDate(l.startDate)} – {toInputDate(l.endDate)}
                  </span>
                  <span className="text-ink-faint">{l.daysCount} dana</span>
                </li>
              ))}
            </ul>
          )}

          {canEdit && <LeaveRecordForm userId={userId} />}
        </div>
      )}
    </div>
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
          <input
            type="date"
            name="hireDate"
            defaultValue={toInputDate(employee?.hireDate ?? null)}
            required
            className="input mt-1"
          />
        </label>
        <label className="text-ink-faint">
          kraj probnog rada
          <input
            type="date"
            name="probationEndDate"
            defaultValue={toInputDate(employee?.probationEndDate ?? null)}
            className="input mt-1"
          />
        </label>
        <label className="text-ink-faint">
          istek ugovora (na određeno)
          <input
            type="date"
            name="contractEndDate"
            defaultValue={toInputDate(employee?.contractEndDate ?? null)}
            className="input mt-1"
          />
        </label>
        <label className="text-ink-faint">
          prestanak radnog odnosa
          <input
            type="date"
            name="terminationDate"
            defaultValue={toInputDate(employee?.terminationDate ?? null)}
            className="input mt-1"
          />
        </label>
        <label className="text-ink-faint">
          dodeljeni dani godišnjeg odmora
          <input
            type="number"
            min={0}
            name="annualLeaveDaysEntitled"
            defaultValue={employee?.annualLeaveDaysEntitled ?? ''}
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
    <form action={formAction} className="flex flex-wrap items-end gap-2 border-t border-border pt-3 text-xs">
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
        <input type="date" name="startDate" required className="input mt-1" />
      </label>
      <label className="text-ink-faint">
        do
        <input type="date" name="endDate" required className="input mt-1" />
      </label>
      <label className="text-ink-faint">
        dana
        <input type="number" min={1} name="daysCount" required className="input mt-1 w-16" />
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
      {pending ? 'Dodajem…' : '+ dodaj odsustvo'}
    </button>
  );
}
