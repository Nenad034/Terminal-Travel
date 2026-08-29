'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { createVolumeTier, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

interface VolumeTier {
  id: string;
  rank: number;
  thresholdMetric: string;
  thresholdPeriod: string;
  thresholdValue: number;
  resultingCommissionPercentage: number | null;
  resultingCommissionFixedAmount: number | null;
  resultingCommissionCurrency: string | null;
  retroactive: boolean;
}

// M7 spec §3.1/§11 — CommissionVolumeTier: pragovi ("Ako obim ≥ X, Onda provizija = Y"), samo
// za Tier 1 (za sub-subagenta ovo postavlja roditelj kroz sopstveni portal, van obima M17 —
// vidi napomenu na stranici detalja). Izmena postojećeg praga (PATCH) namerno nije dodata ovog
// prolaza — kreiranje novog ranga sa ispravnim vrednostima je uobičajen put i dovoljno za
// izlazni kriterijum (M7 §12 stavka o automatskom podizanju provizije); izmena/brisanje ostaje
// otvoreno ako se pokaže potreba (isti princip kao ostatak M17 — nema koda bez stvarne potrebe).
export default function VolumeTiersPanel({ subagentId, tiers }: { subagentId: string; tiers: VolumeTier[] }) {
  const [showForm, setShowForm] = useState(false);
  const boundAction = createVolumeTier.bind(null, subagentId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <div className="mb-4 rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon name="milestone" className="text-accent" /> Pragovi obima (obimski bonus)
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)} variant="link" size="sm" className="h-auto p-0">
          {showForm ? 'zatvori' : '+ novi prag'}
        </Button>
      </div>

      {tiers.length === 0 ? (
        <p className="text-xs text-ink-faint">Nema definisanih pragova — subagent ostaje na osnovnoj proviziji.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {tiers
            .slice()
            .sort((a, b) => b.rank - a.rank)
            .map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded bg-panel2 px-2 py-1.5 text-xs text-ink-dim">
                <span>
                  rang {t.rank} · {t.thresholdMetric} ≥ {t.thresholdValue} / {t.thresholdPeriod}
                </span>
                <span className="text-ink">
                  {t.resultingCommissionPercentage != null ? `${t.resultingCommissionPercentage}%` : ''}
                  {t.resultingCommissionFixedAmount != null ? ` +${t.resultingCommissionFixedAmount} ${t.resultingCommissionCurrency ?? ''}` : ''}
                  {t.retroactive && <span className="ml-2 rounded bg-warn-bg px-1.5 py-0.5 text-[11px] text-warn">retroaktivno</span>}
                </span>
              </div>
            ))}
        </div>
      )}

      {showForm && (
        <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="text-xs text-ink-faint">
            rang
            <input name="rank" type="number" required className="input mt-1 w-16" />
          </label>
          <label className="text-xs text-ink-faint">
            metrika
            <select name="thresholdMetric" required className="input mt-1">
              <option value="TOTAL_SALES_RSD">TOTAL_SALES_RSD</option>
              <option value="BOOKING_COUNT">BOOKING_COUNT</option>
              <option value="NIGHT_COUNT">NIGHT_COUNT</option>
            </select>
          </label>
          <label className="text-xs text-ink-faint">
            period
            <select name="thresholdPeriod" required className="input mt-1">
              <option value="CALENDAR_QUARTER">CALENDAR_QUARTER</option>
              <option value="CALENDAR_YEAR">CALENDAR_YEAR</option>
              <option value="ROLLING_12_MONTHS">ROLLING_12_MONTHS</option>
            </select>
          </label>
          <label className="text-xs text-ink-faint">
            prag ("ako")
            <input name="thresholdValue" type="number" min={0} step="0.01" required className="input mt-1 w-28" />
          </label>
          <label className="text-xs text-ink-faint">
            nova provizija % ("onda")
            <input name="resultingCommissionPercentage" type="number" min={0} max={100} step="0.01" className="input mt-1 w-24" />
          </label>
          <label className="text-xs text-ink-faint">
            fiksan iznos ("onda", opciono)
            <input name="resultingCommissionFixedAmount" type="number" step="0.01" className="input mt-1 w-24" />
          </label>
          <label className="text-xs text-ink-faint">
            valuta fiksnog iznosa
            <input name="resultingCommissionCurrency" className="input mt-1 w-20" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-dim">
            <input type="checkbox" name="retroactive" className="h-3.5 w-3.5" />
            retroaktivno (rabat za dotadašnji promet u periodu)
          </label>
          <SubmitButton />
          {state.error && <span className="w-full text-[11px] text-danger">{state.error}</span>}
        </form>
      )}
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? 'Čuvanje…' : 'sačuvaj prag'}
    </Button>
  );
}
