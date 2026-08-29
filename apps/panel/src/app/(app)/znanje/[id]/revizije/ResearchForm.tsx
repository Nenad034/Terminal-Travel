'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { researchArticle, FormState } from '../../actions';
import { Button } from '@/components/ui/button';

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
      <Button type="button" onClick={() => setOpen(true)} variant="outline" size="sm">
        {revisionId ? 'dostavi istraženi tekst za ovu reviziju' : '+ novo istraživanje'}
      </Button>
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
        <Button type="button" onClick={() => setOpen(false)} variant="ghost" size="sm">
          zatvori
        </Button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Šaljem…' : 'Pošalji na istraživanje'}
    </Button>
  );
}
