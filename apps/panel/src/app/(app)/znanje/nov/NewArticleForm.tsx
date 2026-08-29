'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createArticle, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };
const SOURCE_TYPES = ['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'];
const LANGUAGES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'];

type SubjectType = 'PRODUCT' | 'DESTINATION' | 'COUNTRY';
type Mode = 'empty' | 'manual' | 'research';

// M23 spec §2.1/§4/§8 — POST /knowledge/articles polja prate CreateArticleDto: subjectType
// određuje productId (PRODUCT) vs. destinationCountry/City (DESTINATION/COUNTRY); telo grana
// na `translations[]` (ručan unos) ili `research{}` (AI istraživanje, §4 — isključivo nad
// tekstom koji zaposleni ovde nalepi, nema žive web pretrage u v1). Oba opciona — prazan DRAFT
// je takođe validan.
export default function NewArticleForm() {
  const [state, formAction] = useFormState(createArticle, initialState);
  const [subjectType, setSubjectType] = useState<SubjectType>('DESTINATION');
  const [mode, setMode] = useState<Mode>('research');

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="predmet članka (subject_type)">
        <select name="subjectType" value={subjectType} onChange={(e) => setSubjectType(e.target.value as SubjectType)} className="input">
          <option value="PRODUCT">PRODUCT — konkretan proizvod iz M2 kataloga</option>
          <option value="DESTINATION">DESTINATION — grad/mesto</option>
          <option value="COUNTRY">COUNTRY — zemlja</option>
        </select>
      </Field>

      {subjectType === 'PRODUCT' ? (
        <Field label="product_id (UUID iz M2 kataloga)">
          <input name="productId" required className="input" placeholder="UUID proizvoda" />
        </Field>
      ) : (
        <>
          <Field label="destination_country">
            <input name="destinationCountry" required className="input" placeholder="npr. Grčka" />
          </Field>
          {subjectType === 'DESTINATION' && (
            <Field label="destination_city">
              <input name="destinationCity" className="input" placeholder="npr. Solun" />
            </Field>
          )}
        </>
      )}

      <Field label="sadržaj — kako se popunjava (opciono, može ostati prazan DRAFT)">
        <div className="flex gap-3 text-xs text-ink-dim">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="empty" checked={mode === 'empty'} onChange={() => setMode('empty')} /> prazan (popuni kasnije)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} /> ručan unos
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" value="research" checked={mode === 'research'} onChange={() => setMode('research')} /> AI istraživanje
          </label>
        </div>
      </Field>

      {mode === 'manual' && (
        <div className="flex flex-col gap-2 rounded border border-border bg-panel2 p-3">
          <select name="languageCode" defaultValue="sr" className="input">
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <input name="title" required={mode === 'manual'} className="input" placeholder="naslov" />
          <textarea name="body" required={mode === 'manual'} rows={6} className="input" placeholder="tekst (markdown)" />
        </div>
      )}

      {mode === 'research' && (
        <div className="flex flex-col gap-2 rounded border border-border bg-panel2 p-3">
          <p className="text-[11px] text-ink-faint">
            AI istraživanje (M23 spec §4) radi ISKLJUČIVO nad tekstom koji ovde nalepite — nema žive web pretrage/scraping-a u v1. Nalepite tekst koji ste
            ručno kopirali sa zvaničnog izvora, agent ga strukturira u nacrt ({'ArticleRevision, PENDING_REVIEW'}) koji čeka odobrenje.
          </p>
          <input name="sourceUrl" required={mode === 'research'} className="input" placeholder="izvorni URL (zvaničan sajt/nalog)" />
          <select name="sourceType" defaultValue={subjectType === 'PRODUCT' ? 'HOTEL_OFFICIAL_WEBSITE' : 'GOVERNMENT_OR_TOURISM_BOARD'} className="input">
            {SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <textarea name="rawText" required={mode === 'research'} rows={8} className="input" placeholder="nalepljen tekst sa izvora (§4a — samo zvaničan izvor)" />
        </div>
      )}

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
