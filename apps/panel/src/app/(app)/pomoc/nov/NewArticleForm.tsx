'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { createArticle, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

const AUDIENCE_LABELS: Record<string, string> = {
  STAFF: 'STAFF (interni tim)',
  SUBAGENT: 'SUBAGENT (B2B portal)',
  BUSINESS_CLIENT: 'BUSINESS_CLIENT (korporativni self-service)',
  PUBLIC_GUEST: 'PUBLIC_GUEST (anonimni/pojedinačni B2C gosti)',
};

// M21 spec §2.1/§6 — polja prate CreateHelpArticleDto. generated_by je uvek HUMAN kroz ovaj
// ekran (AI nacrti nastaju isključivo kroz odobren HelpArticleSuggestion, §5.4).
export default function NewArticleForm({ allowedAudience }: { allowedAudience: string[] }) {
  const [state, formAction] = useFormState(createArticle, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="slug (mala slova, brojevi, crtica)">
        <input name="slug" required pattern="[a-z0-9-]+" className="input" placeholder="kako-obraditi-otkazivanje" />
      </Field>

      <Field label="publika (audience) — bira se od segmenata za koje imate EDIT dozvolu">
        <div className="flex flex-col gap-1.5">
          {allowedAudience.map((a) => (
            <label key={a} className="flex items-center gap-2 text-xs text-ink-dim">
              <input type="checkbox" name="audience" value={a} defaultChecked={allowedAudience.length === 1} className="h-3.5 w-3.5" />
              {AUDIENCE_LABELS[a] ?? a}
            </label>
          ))}
        </div>
      </Field>

      <Field label="povezan modul (opciono, npr. M5)">
        <input name="relatedModule" className="input" placeholder="M5" />
      </Field>

      <label className="flex items-center gap-2 text-xs text-ink-dim">
        <input type="checkbox" name="isCriticalExample" className="h-3.5 w-3.5" />
        kritičan primer — korak-po-korak radni scenario (spec §4, izdvaja se u posebnu sekciju)
      </label>

      <SubmitButton />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-xs text-ink-faint">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-1 self-start">
      {pending ? 'Čuvanje…' : 'Sačuvaj članak'}
    </Button>
  );
}
