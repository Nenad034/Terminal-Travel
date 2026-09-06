'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createExchangeRate, type FormState } from './actions';
import DateField from '@/components/DateField';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null, ok: false };

/**
 * Ručni unos kursa (M10 spec §3.1a). Namerno kratka forma — tri polja, jer se koristi u
 * izuzetnoj situaciji (automatski uvoz je zakazao), ne svakodnevno.
 *
 * Valuta je izbor, ne slobodan tekst: sistem prati tačno EUR i USD (`TRACKED_CURRENCIES`), pa
 * bi slobodno polje dozvolilo unos kursa za valutu koju ništa nizvodno ne koristi — zapis bi
 * postojao, a nigde se ne bi pojavio.
 */
export default function ExchangeRateForm() {
  const [state, formAction] = useActionState(createExchangeRate, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-panel p-4">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">valuta</span>
        <select name="currency" defaultValue="EUR" className="input h-9 w-28">
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">datum kursa</span>
        <DateField name="rateDate" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">srednji kurs</span>
        {/* `inputMode="decimal"` + dozvoljena zapeta: kurs se sa sajta NBS-a prepisuje u obliku
            "117,3707", pa se ta zapeta prihvata i pretvara u tačku na serveru. */}
        <input
          name="nbsMiddleRate"
          inputMode="decimal"
          placeholder="117,3707"
          className="input h-9 w-36 font-mono"
          required
        />
      </label>

      <SubmitButton />

      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-ok">Kurs je upisan.</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Upisujem…' : 'Upiši kurs'}
    </Button>
  );
}
