'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Icon from '@/components/Icon';
import { upsertContentTranslation, FormState } from '../actions';

const initialState: FormState = { error: null };
const LANGUAGES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'];

interface Translation {
  languageCode: string;
  title: string;
  body: string;
  isReviewed: boolean;
}

// M12 spec §2.2 — isti obrazac kao M2 ProductTranslation: redovi po jeziku, fallback traženi
// jezik → engleski → srpski. Objavljen sadržaj (status PUBLISHED) više ne prima nove prevode
// preko forme ovde jer approve()/publish() su nepovratna granica (§3) — servis bi ionako odbio
// PATCH, ali PUT translations backend ne blokira eksplicitno, pa UI ostaje otvoren za dodavanje
// jezika i posle objave (ne menja već objavljeni sadržaj, samo proširuje pokrivenost jezika).
export default function TranslationsPanel({ contentId, translations, canEdit }: { contentId: string; translations: Translation[]; canEdit: boolean }) {
  const [editingLang, setEditingLang] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon name="globe" className="text-accent" /> Prevodi
      </div>

      {translations.length === 0 && <p className="mb-2 text-xs text-ink-faint">Nema unetih prevoda.</p>}

      <div className="mb-3 flex flex-col gap-2">
        {translations.map((t) => (
          <div key={t.languageCode} className="rounded border border-border bg-panel2 p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">
                {t.languageCode} {t.isReviewed && <span className="ml-1 text-[11px] text-ok">pregledano</span>}
              </span>
              {canEdit && (
                <button type="button" onClick={() => setEditingLang(t.languageCode)} className="text-[11px] text-accent hover:underline">
                  izmeni
                </button>
              )}
            </div>
            <p className="mt-1 font-medium text-ink">{t.title}</p>
            <p className="mt-1 whitespace-pre-wrap text-ink-dim">{t.body}</p>
          </div>
        ))}
      </div>

      {canEdit && (
        <>
          {editingLang === null ? (
            <button type="button" onClick={() => setEditingLang('sr')} className="rounded border border-border px-3 py-1.5 text-xs font-medium text-ink-dim hover:border-accent">
              + dodaj/izmeni prevod
            </button>
          ) : (
            <TranslationForm
              contentId={contentId}
              existing={translations.find((t) => t.languageCode === editingLang) ?? null}
              initialLang={editingLang}
              onDone={() => setEditingLang(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

function TranslationForm({
  contentId,
  existing,
  initialLang,
  onDone,
}: {
  contentId: string;
  existing: Translation | null;
  initialLang: string;
  onDone: () => void;
}) {
  const boundAction = upsertContentTranslation.bind(null, contentId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <select name="languageCode" defaultValue={initialLang} className="input">
        {LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <input name="title" required defaultValue={existing?.title ?? ''} placeholder="naslov" className="input" />
      <textarea name="body" required rows={5} defaultValue={existing?.body ?? ''} placeholder="tekst — za AI vizual dodati vidljivu napomenu (M12 spec §3c)" className="input" />
      <label className="flex items-center gap-2 text-[11px] text-ink-dim">
        <input type="checkbox" name="isReviewed" defaultChecked={existing?.isReviewed ?? false} className="h-3.5 w-3.5" />
        pregledano
      </label>
      <div className="flex gap-2">
        <SubmitButton />
        <button type="button" onClick={onDone} className="rounded px-3 py-1.5 text-xs font-medium text-ink-faint hover:text-ink">
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
      {pending ? 'Čuvanje…' : 'Sačuvaj prevod'}
    </button>
  );
}
