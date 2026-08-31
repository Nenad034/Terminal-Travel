'use client';

import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { overrideLoyaltyStatus, FormState } from '../actions';
import { Button } from '@/components/ui/button';

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
  const [state, formAction] = useActionState(boundAction, initialState);

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
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      size="sm"
      className="self-start border-warn text-warn hover:bg-warn-bg"
    >
      {pending ? 'Dodeljujem…' : 'Ručno dodeli nivo'}
    </Button>
  );
}
