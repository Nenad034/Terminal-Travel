'use client';

import { useFormStatus } from 'react-dom';
import { useActionState, useState } from 'react';
import { recordPayment, FormState } from '../../actions';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';

const initialState: FormState = { error: null };

export interface BankOption {
  id: string;
  name: string;
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
export default function RecordPaymentForm({
  bookingId,
  currency,
  revalidatePath: path,
  banks,
}: {
  bookingId: string;
  currency: string;
  revalidatePath: string;
  banks: BankOption[];
}) {
  const boundAction = recordPayment.bind(null, bookingId, path);
  const [state, formAction] = useActionState(boundAction, initialState);
  const [method, setMethod] = useState<Method>('BANK_TRANSFER');

  const needsBank = method === 'BANK_TRANSFER' || method === 'CARD_MANUAL';
  const needsCheckDetails = method === 'CHECK';

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-border bg-panel p-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-xs text-danger">{state.error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="iznos">
          <input name="amount" type="number" step="0.01" min={0.01} required className="input w-full" />
        </Field>
        <Field label="valuta">
          <select name="currency" defaultValue={currency} className="input w-full">
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
          <input name="reference" className="input w-full" />
        </Field>
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </div>

      {needsBank && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label={method === 'BANK_TRANSFER' ? 'banka' : 'kartica — banka'}>
            <select name="bankId" required className="input w-full">
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

      {needsCheckDetails && <CheckDetailsFields banks={banks} />}
    </form>
  );
}

// M10 spec §5.2 dopuna (2.9.2026) — "specifikacija čekova": jedna uplata metodom ČEK može biti
// pokrivena više fizičkih čekova (banka/iznos/broj čeka/datum realizacije po redu), zbir mora
// pokriti ceo iznos uplate (proveren na serveru, `PaymentsService.recordManualPayment`).
function CheckDetailsFields({ banks }: { banks: BankOption[] }) {
  const [rows, setRows] = useState([0]);
  let nextKey = rows.length;

  return (
    <div className="space-y-2 rounded border border-border bg-panel2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">Specifikacija čekova</span>
        <button type="button" onClick={() => setRows((r) => [...r, nextKey++])} className="flex items-center gap-1 text-xs text-accent hover:underline">
          <Icon name="add" /> dodaj ček
        </button>
      </div>
      {rows.map((rowKey, i) => (
        <div key={rowKey} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="banka">
            <select name="checkBankId" required className="input w-full">
              <option value="">— izaberite banku —</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="iznos">
            <input name="checkAmount" type="number" step="0.01" min={0.01} required className="input w-full" />
          </Field>
          <Field label="broj čeka">
            <input name="checkNumber" required className="input w-full" />
          </Field>
          <Field label="datum realizacije">
            <input name="checkClearanceDate" type="date" required className="input w-full" />
          </Field>
          <div className="flex items-end">
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows((r) => r.filter((k) => k !== rowKey))} className="text-xs text-danger hover:underline">
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Beležim…' : 'Zabeleži uplatu'}
    </Button>
  );
}
