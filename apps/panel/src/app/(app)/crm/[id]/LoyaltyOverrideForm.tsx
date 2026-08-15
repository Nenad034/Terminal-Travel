'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { overrideLoyaltyStatus, FormState } from '../actions';

const initialState: FormState = { error: null };

interface Tier {
  id: string;
  name: string;
  rank: number;
  discountPercentage: number;
}

// M6 spec §3.2 — ručna dodela nivoa lojalnosti mimo praga, obavezan razlog, uvek pobeđuje
// nad automatski izračunatim nivoom (Vlasnik/Direktor, M6/loyalty-status/OVERRIDE).
export default function LoyaltyOverrideForm({ clientAccountId, tiers }: { clientAccountId: string; tiers: Tier[] }) {
  const boundAction = overrideLoyaltyStatus.bind(null, clientAccountId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <label className="text-[11px] text-ink-faint">
        ručna dodela nivoa
        <select name="tierId" required className="input mt-1">
          {tiers
            .slice()
            .sort((a, b) => b.rank - a.rank)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.discountPercentage}%)
              </option>
            ))}
        </select>
      </label>
      <label className="text-[11px] text-ink-faint">
        razlog (obavezno)
        <input name="reason" required className="input mt-1" placeholder="npr. poslovni partner" />
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded border border-warn px-3 py-1 text-[11px] font-semibold text-warn hover:bg-warn-bg disabled:opacity-50"
    >
      {pending ? 'Dodeljujem…' : 'Ručno dodeli nivo'}
    </button>
  );
}
