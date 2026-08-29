'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPeriod, FormState } from '../actions';
import { ButtonGroup, ToggleButton } from '@/components/ButtonGroup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DateField from '@/components/DateField';

const initialState: FormState = { error: null };

export type AllotmentMode = 'FIXED' | 'ON_REQUEST' | 'CHARTER' | 'FIXED_LEASE';
export type AgeCategory = 'ADULT' | 'CHILD' | 'TEEN' | 'INFANT';

export interface AgePolicyOverrideEntry {
  category: AgeCategory;
  ageFrom: number;
  ageTo: number | null;
  countsTowardCapacity: boolean;
  requiresCrib?: boolean;
  cribIncluded?: boolean | null;
}

export interface ContractPeriod {
  id: string;
  stayFrom: string;
  stayTo: string;
  roomType: string;
  allotmentMode: AllotmentMode;
  totalCapacity: number | null;
  unitsSold: number;
  releaseDaysBefore: number | null;
}

const MODE_LABELS: Record<AllotmentMode, string> = { FIXED: 'Fiksni alotman', ON_REQUEST: 'Na upit', CHARTER: 'Čarter', FIXED_LEASE: 'Fiksni zakup' };
const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = { ADULT: 'Odrasla osoba', CHILD: 'Dete', TEEN: 'Tinejdžer', INFANT: 'Beba' };

// M3 spec §2.3/§2.3a/§2.3c — backlog nalaz (docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md, M3
// sekcija, 28.8.2026): lista ugovora je postojala, ali nema detalj-ekrana za unos perioda/
// cenovnika — sve je do sada bilo API-only. Ovaj panel zatvara taj gap za `ContractPeriod`
// (RateLine/CancellationRule imaju svoj ekran, vidi periods/[periodId]/page.tsx).
export default function PeriodsPanel({ contractId, periods, canEdit }: { contractId: string; periods: ContractPeriod[]; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Periodi / sezone</h2>
        {canEdit && (
          <Button onClick={() => setShowForm((v) => !v)} size="sm">
            {showForm ? 'Zatvori' : '+ Nov period'}
          </Button>
        )}
      </div>

      {periods.length === 0 && <p className="text-xs text-ink-faint">Nijedan period još nije unet.</p>}

      <div className="flex flex-col gap-1.5">
        {periods.map((p) => (
          <Link
            key={p.id}
            href={`/ugovori/${contractId}/periods/${p.id}`}
            className="flex items-center justify-between rounded-lg border border-border bg-panel2 px-3 py-2 text-xs hover:border-accent"
          >
            <div>
              <span className="font-medium text-ink">{p.roomType}</span>
              <span className="ml-2 text-ink-faint">
                {new Date(p.stayFrom).toLocaleDateString('sr-RS')} – {new Date(p.stayTo).toLocaleDateString('sr-RS')}
              </span>
              {p.totalCapacity != null && (
                <span className="ml-2 text-ink-faint">
                  · {p.unitsSold}/{p.totalCapacity} prodato
                </span>
              )}
            </div>
            <Badge variant="secondary">{MODE_LABELS[p.allotmentMode]}</Badge>
          </Link>
        ))}
      </div>

      {showForm && canEdit && <NewPeriodForm contractId={contractId} />}
    </div>
  );
}

function NewPeriodForm({ contractId }: { contractId: string }) {
  const boundAction = createPeriod.bind(null, contractId);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [mode, setMode] = useState<AllotmentMode>('FIXED');
  const [agePolicy, setAgePolicy] = useState<AgePolicyOverrideEntry[]>([]);

  return (
    <form
      action={(fd) => {
        fd.set('agePolicyOverride', agePolicy.length > 0 ? JSON.stringify(agePolicy) : '');
        formAction(fd);
      }}
      className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-xs"
    >
      {state.error && <p className="rounded bg-danger-bg p-2 text-danger">{state.error}</p>}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Period boravka od">
          <DateField name="stayFrom" required />
        </Field>
        <Field label="Period boravka do">
          <DateField name="stayTo" required />
        </Field>
        <Field label="Šifra tipa sobe">
          <input name="roomType" required className="input" placeholder="mora odgovarati room_types[].code (M2)" />
        </Field>
      </div>

      <Field label="Vrsta alotmana">
        <input type="hidden" name="allotmentMode" value={mode} />
        <ButtonGroup value={mode} onChange={setMode} options={(Object.keys(MODE_LABELS) as AllotmentMode[]).map((m) => ({ value: m, label: MODE_LABELS[m] }))} />
      </Field>

      {mode !== 'ON_REQUEST' && (
        <Field label="Ukupan kapacitet">
          <input name="totalCapacity" type="number" min={1} required className="input w-32" />
        </Field>
      )}

      {mode === 'FIXED' && (
        <Field label="Rok povrata alotmana (dana pre stay_from)">
          <input name="releaseDaysBefore" type="number" min={0} className="input w-32" />
        </Field>
      )}

      {(mode === 'CHARTER' || mode === 'FIXED_LEASE') && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ukupna fiksna obaveza">
            <input name="ukupnaFiksnaObaveza" type="number" min={1} required className="input" />
          </Field>
          <Field label="Valuta obaveze">
            <input name="fixedObligationCurrency" required className="input" placeholder="EUR" />
          </Field>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-ink-faint">Uzrasna politika — izuzetak za ovaj period (opciono, M3 spec §2.3c)</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto px-2 py-1 text-[11px]"
            onClick={() => setAgePolicy([...agePolicy, { category: 'CHILD', ageFrom: 0, ageTo: null, countsTowardCapacity: true }])}
          >
            + dodaj kategoriju
          </Button>
        </div>
        {agePolicy.length === 0 && <p className="text-ink-faint">Bez izuzetka — koristi se opšta politika sobe (M2).</p>}
        <div className="flex flex-col gap-1.5">
          {agePolicy.map((ap, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-1.5 rounded border border-border p-2">
              <Field label="Kategorija">
                <ButtonGroup
                  value={ap.category}
                  onChange={(c) => {
                    const next = [...agePolicy];
                    next[i] = { ...ap, category: c };
                    setAgePolicy(next);
                  }}
                  options={(Object.keys(AGE_CATEGORY_LABELS) as AgeCategory[]).map((c) => ({ value: c, label: AGE_CATEGORY_LABELS[c] }))}
                />
              </Field>
              <Field label="Od uzrasta">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={ap.ageFrom}
                  onChange={(e) => {
                    const next = [...agePolicy];
                    next[i] = { ...ap, ageFrom: Number(e.target.value) };
                    setAgePolicy(next);
                  }}
                />
              </Field>
              <Field label="Do uzrasta">
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="i više"
                  value={ap.ageTo ?? ''}
                  onChange={(e) => {
                    const next = [...agePolicy];
                    next[i] = { ...ap, ageTo: e.target.value === '' ? null : Number(e.target.value) };
                    setAgePolicy(next);
                  }}
                />
              </Field>
              <div className="pb-2">
                <ToggleButton
                  active={ap.countsTowardCapacity}
                  onToggle={() => {
                    const next = [...agePolicy];
                    next[i] = { ...ap, countsTowardCapacity: !ap.countsTowardCapacity };
                    setAgePolicy(next);
                  }}
                  label="u kapacitet"
                />
              </div>
              <Button type="button" variant="ghost" size="sm" className="mb-2 h-auto px-2 py-1 text-ink-faint hover:text-danger" onClick={() => setAgePolicy(agePolicy.filter((_, idx) => idx !== i))}>
                ukloni
              </Button>
            </div>
          ))}
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Čuvanje…' : 'Sačuvaj period'}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
