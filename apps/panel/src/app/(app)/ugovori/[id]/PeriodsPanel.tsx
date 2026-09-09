'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { createPeriod, updatePeriod, deletePeriod, FormState } from '../actions';
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
  /** §2.3d — ugašen period ostaje osnov postojećih rezervacija, ali ne prima nove. */
  status?: 'ACTIVE' | 'INACTIVE';
  stayFrom: string;
  stayTo: string;
  roomType: string;
  allotmentMode: AllotmentMode;
  totalCapacity: number | null;
  unitsSold: number;
  releaseDaysBefore: number | null;
  minStayNights: number | null;
  maxStayNights: number | null;
  // §2.11d — turnusi; prazan niz = bez ograničenja.
  arrivalWeekdays?: number[];
  departureWeekdays?: number[];
  allowedStayNights?: number[];
}

// §2.11d — dani se biraju kao tagovi (vlasnikova odluka): „vikend" nije isti u svakom hotelu.
const DANI: { broj: number; kratko: string; pun: string }[] = [
  { broj: 1, kratko: 'pon', pun: 'ponedeljak' },
  { broj: 2, kratko: 'uto', pun: 'utorak' },
  { broj: 3, kratko: 'sre', pun: 'sreda' },
  { broj: 4, kratko: 'čet', pun: 'četvrtak' },
  { broj: 5, kratko: 'pet', pun: 'petak' },
  { broj: 6, kratko: 'sub', pun: 'subota' },
  { broj: 7, kratko: 'ned', pun: 'nedelja' },
];

/**
 * Turnusi — dani prijave/odjave i dozvoljene dužine boravka (M3 §2.11d).
 *
 * Kvačice, ne padajuća lista: turnus je „subota i sreda", ne jedna vrednost. Ništa označeno
 * znači BEZ ograničenja — što je i jedino stanje koje ne menja zatečene periode.
 */
function TurnusPolja({
  imeDolazak,
  imeOdlazak,
  dolasci = [],
  odlasci = [],
  noci = [],
}: {
  imeDolazak: string;
  imeOdlazak: string;
  dolasci?: number[];
  odlasci?: number[];
  noci?: number[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border bg-panel2 p-3">
      <span className="text-[11px] font-medium text-ink-dim">
        Turnusi (opciono, M3 spec §2.11d)
      </span>
      {[
        { ime: imeDolazak, naslov: 'Dani prijave', izabrani: dolasci },
        { ime: imeOdlazak, naslov: 'Dani odjave', izabrani: odlasci },
      ].map((red) => (
        <div key={red.ime} className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[11px] text-ink-faint">{red.naslov}</span>
          {DANI.map((d) => (
            <label key={d.broj} className="flex items-center gap-1 text-[11px] text-ink-dim">
              <input
                type="checkbox"
                name={red.ime}
                value={d.broj}
                defaultChecked={red.izabrani.includes(d.broj)}
              />
              <span title={d.pun}>{d.kratko}</span>
            </label>
          ))}
        </div>
      ))}
      <label className="flex items-center gap-2 text-[11px] text-ink-faint">
        <span className="w-24">Dužine boravka</span>
        <input
          name="allowedStayNights"
          className="input w-40 text-xs"
          placeholder="7, 10, 14"
          defaultValue={noci.join(', ')}
        />
        <span className="text-[10px]">noći, odvojeno zarezom; prazno = bez ograničenja</span>
      </label>
    </div>
  );
}

const MODE_LABELS: Record<AllotmentMode, string> = {
  FIXED: 'Fiksni alotman',
  ON_REQUEST: 'Na upit',
  CHARTER: 'Čarter',
  FIXED_LEASE: 'Fiksni zakup',
};
const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  ADULT: 'Odrasla osoba',
  CHILD: 'Dete',
  TEEN: 'Tinejdžer',
  INFANT: 'Beba',
};

// M3 spec §2.3/§2.3a/§2.3c — backlog nalaz (docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md, M3
// sekcija, 28.8.2026): lista ugovora je postojala, ali nema detalj-ekrana za unos perioda/
// cenovnika — sve je do sada bilo API-only. Ovaj panel zatvara taj gap za `ContractPeriod`
// (RateLine/CancellationRule imaju svoj ekran, vidi periods/[periodId]/page.tsx).
export default function PeriodsPanel({
  contractId,
  periods,
  canEdit,
}: {
  contractId: string;
  periods: ContractPeriod[];
  canEdit: boolean;
}) {
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

      {periods.length === 0 && (
        <p className="text-xs text-ink-faint">Nijedan period još nije unet.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {periods.map((p) => (
          <PeriodRow key={p.id} contractId={contractId} period={p} canEdit={canEdit} />
        ))}
      </div>

      {showForm && canEdit && <NewPeriodForm contractId={contractId} />}
    </div>
  );
}

// §2.3d (8.9.2026) — red perioda sa izmenom i gašenjem. Do ove verzije period se mogao samo
// otvoriti (link ka cenovniku); pogrešno unet kapacitet/datum/tip sobe nije se mogao ispraviti
// kroz aplikaciju, jer PATCH/DELETE nisu ni postojali na backend-u.
function PeriodRow({
  contractId,
  period,
  canEdit,
}: {
  contractId: string;
  period: ContractPeriod;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const neaktivan = period.status === 'INACTIVE';

  return (
    <div
      className={`rounded-lg border border-border bg-panel2 text-xs ${neaktivan ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Link
          href={`/ugovori/${contractId}/periods/${period.id}`}
          className="flex-1 hover:text-accent-strong"
        >
          <span className="font-medium text-ink">{period.roomType}</span>
          <span className="ml-2 text-ink-faint">
            {new Date(period.stayFrom).toLocaleDateString('sr-RS')} –{' '}
            {new Date(period.stayTo).toLocaleDateString('sr-RS')}
          </span>
          {period.totalCapacity != null && (
            <span className="ml-2 text-ink-faint">
              · {period.unitsSold}/{period.totalCapacity} prodato
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2">
          {neaktivan && <Badge variant="outline">ugašen</Badge>}
          <Badge variant="secondary">{MODE_LABELS[period.allotmentMode]}</Badge>
          {canEdit && !neaktivan && (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="rounded px-2 py-1 text-[11px] text-accent-strong hover:bg-sunken"
              >
                {editing ? 'Odustani' : 'Izmeni'}
              </button>
              <DeletePeriodButton contractId={contractId} period={period} />
            </>
          )}
        </div>
      </div>
      {editing && (
        <EditPeriodForm contractId={contractId} period={period} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}

function EditPeriodForm({
  contractId,
  period,
  onDone,
}: {
  contractId: string;
  period: ContractPeriod;
  onDone: () => void;
}) {
  const boundAction = updatePeriod.bind(null, contractId, period.id);
  const [state, formAction] = useActionState(boundAction, initialState);
  // Backend odbija smanjenje ispod prodatog dok se ne potvrdi drugi put (§2.3d) — poruku
  // prepoznajemo po tome što nosi "bez pokrića", i pretvaramo je u pitanje sa drugim dugmetom.
  const trebaPotvrda = Boolean(state.error?.includes('bez pokrića'));

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-border p-3">
      {state.error && (
        <p
          className={`rounded p-2 ${trebaPotvrda ? 'bg-warn-bg text-warn' : 'bg-danger-bg text-danger'}`}
        >
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Field label="Period boravka od">
          <DateField name="stayFrom" required defaultValue={period.stayFrom.slice(0, 10)} />
        </Field>
        <Field label="Period boravka do">
          <DateField name="stayTo" required defaultValue={period.stayTo.slice(0, 10)} />
        </Field>
        <Field label="Šifra tipa sobe">
          <input name="roomType" required className="input" defaultValue={period.roomType} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {period.allotmentMode !== 'ON_REQUEST' && (
          <Field label={`Ukupan kapacitet (prodato: ${period.unitsSold})`}>
            <input
              name="totalCapacity"
              type="number"
              min={0}
              className="input"
              defaultValue={period.totalCapacity ?? ''}
            />
          </Field>
        )}
        <Field label="Minimalan broj noćenja">
          <input
            name="minStayNights"
            type="number"
            min={1}
            className="input"
            defaultValue={period.minStayNights ?? ''}
          />
        </Field>
        <Field label="Maksimalan broj noćenja">
          <input
            name="maxStayNights"
            type="number"
            min={1}
            className="input"
            defaultValue={period.maxStayNights ?? ''}
          />
        </Field>
      </div>

      <TurnusPolja
        imeDolazak="arrivalWeekdays"
        imeOdlazak="departureWeekdays"
        dolasci={period.arrivalWeekdays}
        odlasci={period.departureWeekdays}
        noci={period.allowedStayNights}
      />

      {trebaPotvrda && <input type="hidden" name="confirmOversold" value="da" />}

      <div className="flex items-center gap-2">
        <AkcijaDugme label={trebaPotvrda ? 'Ipak sačuvaj (znam za prekoračenje)' : 'Sačuvaj'} />
        <button
          type="button"
          onClick={onDone}
          className="rounded px-3 py-1.5 text-[11px] text-ink-dim hover:bg-sunken"
        >
          Zatvori
        </button>
      </div>
    </form>
  );
}

function DeletePeriodButton({
  contractId,
  period,
}: {
  contractId: string;
  period: ContractPeriod;
}) {
  const boundAction = deletePeriod.bind(null, contractId, period.id);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [potvrda, setPotvrda] = useState(false);

  if (!potvrda) {
    return (
      <button
        type="button"
        onClick={() => setPotvrda(true)}
        className="rounded px-2 py-1 text-[11px] text-danger hover:bg-danger-bg"
      >
        Ugasi
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1">
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
      <span className="text-[11px] text-ink-faint">
        {period.unitsSold > 0 ? 'Ima rezervacije — biće ugašen' : 'Nema rezervacija — briše se'}
      </span>
      <AkcijaDugme label="Potvrdi" />
      <button
        type="button"
        onClick={() => setPotvrda(false)}
        className="rounded px-2 py-1 text-[11px] text-ink-dim hover:bg-sunken"
      >
        Ne
      </button>
    </form>
  );
}

function AkcijaDugme({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Čuvam…' : label}
    </Button>
  );
}

function NewPeriodForm({ contractId }: { contractId: string }) {
  const boundAction = createPeriod.bind(null, contractId);
  const [state, formAction] = useActionState(boundAction, initialState);
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
          <input
            name="roomType"
            required
            className="input"
            placeholder="mora odgovarati room_types[].code (M2)"
          />
        </Field>
      </div>

      <Field label="Vrsta alotmana">
        <input type="hidden" name="allotmentMode" value={mode} />
        <ButtonGroup
          value={mode}
          onChange={setMode}
          options={(Object.keys(MODE_LABELS) as AllotmentMode[]).map((m) => ({
            value: m,
            label: MODE_LABELS[m],
          }))}
        />
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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Minimalan broj noćenja (opciono, M3 spec §2.3)">
          <input name="minStayNights" type="number" min={1} className="input w-32" />
        </Field>
        <Field label="Maksimalan broj noćenja (opciono, M3 spec §2.3)">
          <input name="maxStayNights" type="number" min={1} className="input w-32" />
        </Field>
      </div>

      <TurnusPolja imeDolazak="arrivalWeekdays" imeOdlazak="departureWeekdays" />

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
          <span className="text-ink-faint">
            Uzrasna politika — izuzetak za ovaj period (opciono, M3 spec §2.3c)
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto px-2 py-1 text-[11px]"
            onClick={() =>
              setAgePolicy([
                ...agePolicy,
                { category: 'CHILD', ageFrom: 0, ageTo: null, countsTowardCapacity: true },
              ])
            }
          >
            + dodaj kategoriju
          </Button>
        </div>
        {agePolicy.length === 0 && (
          <p className="text-ink-faint">Bez izuzetka — koristi se opšta politika sobe (M2).</p>
        )}
        <div className="flex flex-col gap-1.5">
          {agePolicy.map((ap, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-1.5 rounded border border-border p-2"
            >
              <Field label="Kategorija">
                <ButtonGroup
                  value={ap.category}
                  onChange={(c) => {
                    const next = [...agePolicy];
                    next[i] = { ...ap, category: c };
                    setAgePolicy(next);
                  }}
                  options={(Object.keys(AGE_CATEGORY_LABELS) as AgeCategory[]).map((c) => ({
                    value: c,
                    label: AGE_CATEGORY_LABELS[c],
                  }))}
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
                    next[i] = {
                      ...ap,
                      ageTo: e.target.value === '' ? null : Number(e.target.value),
                    };
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-2 h-auto px-2 py-1 text-ink-faint hover:text-danger"
                onClick={() => setAgePolicy(agePolicy.filter((_, idx) => idx !== i))}
              >
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
