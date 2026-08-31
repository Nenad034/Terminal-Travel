'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { createContent, FormState } from '../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };
const TYPES = ['BLOG_POST', 'SOCIAL_POST', 'EMAIL_NEWSLETTER', 'BANNER', 'STATIC_PAGE'];
const CHANNELS = ['M8_SITE', 'FACEBOOK', 'INSTAGRAM', 'EMAIL', 'MOBILE_PUSH'];
const SLUG_REQUIRED_TYPES = ['STATIC_PAGE', 'BLOG_POST'];

// M12 spec §2.1/§7 — polja prate CreateContentDto. slug je obavezan za STATIC_PAGE/BLOG_POST
// (§3b) — servis to i dalje proverava, ovde je samo UI napomena.
export default function NewContentForm() {
  const [state, formAction] = useActionState(createContent, initialState);
  const [type, setType] = useState('BLOG_POST');
  const slugRequired = SLUG_REQUIRED_TYPES.includes(type);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5">
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <Field label="tip">
        <select name="type" required value={type} onChange={(e) => setType(e.target.value)} className="input">
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      {slugRequired && (
        <Field label={`slug (obavezno za ${type})`}>
          <input name="slug" required className="input" placeholder="o-nama" />
        </Field>
      )}

      <Field label="proizvod (M2 Product ID, opciono)">
        <input name="productId" className="input" placeholder="UUID — ostavite prazno za opšti sadržaj" />
      </Field>

      <Field label="ciljni kanali">
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center gap-1 text-xs text-ink-dim">
              <input type="checkbox" name="targetChannels" value={c} className="h-3.5 w-3.5" />
              {c}
            </label>
          ))}
        </div>
      </Field>

      <Field label="oznake za EMAIL kanal (odvojene zarezom, opciono)">
        <input name="targetTags" className="input" placeholder="VIP, porodica" />
      </Field>

      <Field label="zakazana objava (opciono)">
        <input name="scheduledPublishAt" type="datetime-local" className="input" />
      </Field>

      <label className="flex items-center gap-2 text-xs text-ink-dim">
        <input type="checkbox" name="containsAiGeneratedMedia" className="h-3.5 w-3.5" />
        sadrži sintetički AI-generisan vizual (YUTA preporuka, M12 spec §3c)
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
      {pending ? 'Čuvanje…' : 'Sačuvaj sadržaj'}
    </Button>
  );
}
