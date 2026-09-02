'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useEffect, useState } from 'react';
import { recordPayment, updatePayment, FormState } from '../../actions';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import DateField from '@/components/DateField';

const initialState: FormState = { error: null };

export interface BankOption {
  id: string;
  name: string;
}

// M10 spec §5.2 dopuna (2.9.2026) — podaci potrebni da forma otvori postojeću uplatu u režimu
// izmene, predpopunjenu njenim trenutnim vrednostima; `amount`/`checkDetails[].amount` u
// najmanjim jedinicama (para/centi) kao i svuda u M10, konvertuju se u decimalni zapis samo za
// prikaz u polju.
export interface EditablePayment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  bankId?: string | null;
  checkDetails?: { bankId: string; amount: number; checkNumber: string; clearanceDate: string }[];
}

const METHOD_OPTIONS = [
  { value: 'BANK_TRANSFER', label: 'bankovni prenos' },
  { value: 'CASH', label: 'gotovina' },
  { value: 'CARD_MANUAL', label: 'kreditna kartica' },
  { value: 'CHECK', label: 'ček' },
  { value: 'ADMINISTRATIVE_BAN', label: 'administrativna zabrana' },
] as const;

type Method = (typeof METHOD_OPTIONS)[number]['value'];

// M10 spec §5.2/§9 — ručan unos prijema uplate. CARD (bez _MANUAL) se beleži isključivo preko
// webhook-a i namerno nije ponuđeno ovde. Gotovina namerno bez sistemskog limita (§5.2).
// Dopuna (2.9.2026, na zahtev vlasnika): CARD_MANUAL/CHECK/ADMINISTRATIVE_BAN dodati; svako
// polje ima labelu IZNAD sebe i istu širinu (`input` klasa, grid raspored) umesto ranijeg
// "label pa input u istom redu" koje je na uskom prostoru lomilo "način" u poseban red.
// Dopuna (2.9.2026, na zahtev vlasnika: "omogućiti korigovanje specifikacije") — isti obrazac
// koristi se i za IZMENU postojeće uplate (`editPayment` prisutan): predpopunjena polja, PATCH
// umesto POST, API sam blokira ako je fiskalizacija već u toku (`editable` iz liste uplata).
export default function RecordPaymentForm({
  bookingId,
  currency,
  revalidatePath: path,
  banks,
  editPayment,
  onDone,
}: {
  bookingId: string;
  currency: string;
  revalidatePath: string;
  banks: BankOption[];
  editPayment?: EditablePayment;
  onDone?: () => void;
}) {
  const boundAction = editPayment ? updatePayment.bind(null, editPayment.id, path) : recordPayment.bind(null, bookingId, path);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [method, setMethod] = useState<Method>((editPayment?.method as Method) ?? 'BANK_TRANSFER');

  // Dopuna (2.9.2026) — posle uspešne izmene forma treba sama da se vrati u prikaz reda (ne
  // ostaje otvorena sa zastarelim vrednostima); `state` menja identitet (referencu) samo posle
  // stvarnog slanja forme (na montiranju je uvek isti `initialState` objekat iz modula), zato
  // poredimo referencu umesto "da li je ovo prvi render" praporcem — ranija verzija sa
  // ref-flagom je lažno zatvarala formu odmah po otvaranju pod React StrictMode-om (dev), jer
  // se efekat tamo namerno pokreće dvaput i flag bi se već oborio pri prvom pozivu.
  useEffect(() => {
    if (state !== initialState && !state.error && editPayment && onDone) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const needsBank = method === 'BANK_TRANSFER' || method === 'CARD_MANUAL';
  const needsCheckDetails = method === 'CHECK';

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-panel p-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-xs text-danger">{state.error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="iznos">
          <input
            name="amount"
            type="number"
            step="0.01"
            min={0.01}
            required
            defaultValue={editPayment ? (editPayment.amount / 100).toFixed(2) : undefined}
            className="input w-full"
          />
        </Field>
        <Field label="valuta">
          <select name="currency" defaultValue={editPayment?.currency ?? currency} className="input w-full">
            <option value="RSD">RSD</option>
            <option value="EUR">EUR</option>
          </select>
        </Field>
        <Field label="način">
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value as Method)} className="input w-full">
            {METHOD_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="poziv na broj (opciono)">
          <input name="reference" defaultValue={editPayment?.reference ?? undefined} className="input w-full" />
        </Field>
        {/* Dopuna (2.9.2026, na zahtev vlasnika: "dugme zabeleži uplatu nije u pravcu polja
            pored") — nevidljiva labela iste visine kao kod suseda (Field ispod) da dugme sedi
            na istoj visini kao sadržaj input polja, ne poravnato uz vrh reda. */}
        <div className="flex items-end gap-2">
          <SubmitButton editing={Boolean(editPayment)} />
          {editPayment && onDone && (
            <button type="button" onClick={onDone} className="text-xs text-ink-faint hover:text-ink hover:underline">
              otkaži
            </button>
          )}
        </div>
      </div>

      {needsBank && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label={method === 'BANK_TRANSFER' ? 'banka' : 'kartica — banka'}>
            <select name="bankId" required defaultValue={editPayment?.bankId ?? ''} className="input w-full">
              <option value="">— izaberite banku —</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {needsCheckDetails && <CheckDetailsFields banks={banks} initialRows={editPayment?.checkDetails} />}
    </form>
  );
}

// M10 spec §5.2 dopuna (2.9.2026) — "specifikacija čekova": jedna uplata metodom ČEK može biti
// pokrivena više fizičkih čekova (banka/iznos/broj čeka/datum realizacije po redu), zbir mora
// pokriti ceo iznos uplate (proveren na serveru, `PaymentsService.recordManualPayment`).
// Redovi drže SOPSTVENU `bankId` u state (kontrolisan select) — ne zato što forma treba React
// state za slanje (i dalje šalje preko `name="checkBankId"`), nego isključivo da "dodaj ček"
// može da predloži banku iz prethodnog reda (vlasnikov zahtev — čekovi iste specifikacije su
// najčešće iz iste banke).
let nextRowId = 1;
function CheckDetailsFields({
  banks,
  initialRows,
}: {
  banks: BankOption[];
  initialRows?: { bankId: string; amount: number; checkNumber: string; clearanceDate: string }[];
}) {
  const [rows, setRows] = useState<{ id: number; bankId: string; amount?: string; checkNumber?: string; clearanceDate?: string }[]>(
    () =>
      initialRows && initialRows.length > 0
        ? initialRows.map((r, i) => ({
            id: -(i + 1),
            bankId: r.bankId,
            amount: (r.amount / 100).toFixed(2),
            checkNumber: r.checkNumber,
            clearanceDate: r.clearanceDate.slice(0, 10),
          }))
        : [{ id: 0, bankId: '' }],
  );

  function addRow() {
    setRows((r) => [...r, { id: nextRowId++, bankId: r[r.length - 1]?.bankId ?? '' }]);
  }

  return (
    <div className="space-y-2 rounded border border-border bg-panel2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Specifikacija čekova</span>
        <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs text-accent hover:underline">
          <Icon name="add" /> dodaj ček
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="banka">
            <select
              name="checkBankId"
              value={row.bankId}
              onChange={(e) => setRows((r) => r.map((x) => (x.id === row.id ? { ...x, bankId: e.target.value } : x)))}
              required
              className="input w-full"
            >
              <option value="">— izaberite banku —</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="iznos">
            <input name="checkAmount" type="number" step="0.01" min={0.01} required defaultValue={row.amount} className="input w-full" />
          </Field>
          <Field label="broj čeka">
            <input name="checkNumber" required defaultValue={row.checkNumber} className="input w-full" />
          </Field>
          <Field label="datum realizacije">
            <DateField name="checkClearanceDate" required defaultValue={row.clearanceDate} />
          </Field>
          <div className="flex items-end">
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows((r) => r.filter((x) => x.id !== row.id))} className="text-xs text-danger hover:underline">
                ukloni
              </button>
            )}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-ink-faint">Zbir iznosa svih čekova mora biti jednak ukupnom iznosu uplate iznad.</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-ink-faint">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Čuvam…' : editing ? 'Sačuvaj izmenu' : 'Zabeleži uplatu'}
    </Button>
  );
}
