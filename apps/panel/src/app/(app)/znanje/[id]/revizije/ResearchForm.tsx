'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { researchArticle, FormState } from '../../actions';

const initialState: FormState = { error: null };
const SOURCE_TYPES = ['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'];

// Nedostatak 3 (M17 Faza 7, rešeno) — forma za POST /knowledge/articles/:id/research. Kad je
// prosleđen `revisionId` (npr. na prazan SCHEDULED_REFRESH placeholder), dugme za otvaranje forme
// je vezano baš za TU reviziju — popunjava je umesto da pravi novu (M23 spec §4c). Bez revisionId
// (dugme na vrhu liste), pravi novu reviziju (isti ulaz kao istraživanje pri kreiranju članka).
export default function ResearchForm({ articleId, revisionId }: { articleId: string; revisionId?: string }) {
  const [open, setOpen] = useState(false);
  const boundAction = researchArticle.bind(null, articleId, revisionId ?? null);
  const [state, formAction] = useFormState(boundAction, initialState);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent"
      >
        {revisionId ? 'dostavi istraženi tekst za ovu reviziju' : '+ novo istraživanje'}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 rounded border border-border bg-panel2 p-3 text-xs">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <input name="sourceUrl" required placeholder="URL izvora (zvaničan sajt/društvena mreža hotela ili turističke organizacije)" className="input" />
      <select name="sourceType" defaultValue={SOURCE_TYPES[0]} className="input">
        {SOURCE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <textarea name="rawText" required rows={8} placeholder="nalepljen sirov tekst sa izvora" className="input" />
      <div className="flex gap-2">
        <SubmitButton />
        <button type="button" onClick={() => setOpen(false)} className="rounded px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink">
          zatvori
        </button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Šaljem…' : 'Pošalji na istraživanje'}
    </button>
  );
}
