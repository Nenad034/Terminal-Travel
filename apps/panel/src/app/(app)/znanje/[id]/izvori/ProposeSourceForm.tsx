'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { proposeSource, FormState } from '../../actions';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };
// M23 spec §2.3/§4a — jedini dozvoljeni tipovi izvora, bez izuzetka. Nema OTHER/OTA/REVIEW_SITE
// opcije — agregatori i sajtovi sa recenzijama se nikad ne koriste kao izvor.
const SOURCE_TYPES = ['HOTEL_OFFICIAL_WEBSITE', 'HOTEL_SOCIAL_MEDIA', 'GOVERNMENT_OR_TOURISM_BOARD'];

// M23 spec §2.3/§8 — POST /knowledge/articles/:id/sources, ručno predlaganje kandidata (zahteva
// M23/article/EDIT). Predlog ostaje CANDIDATE dok neko sa M23/article-source/APPROVE ne odobri.
export default function ProposeSourceForm({ articleId }: { articleId: string }) {
  const boundAction = proposeSource.bind(null, articleId);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-border bg-panel p-4">
      {state.error && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>}
      <label className="text-xs text-ink-faint">
        url (zvaničan sajt/društvena mreža/državni portal)
        <input name="url" required className="input mt-1" placeholder="https://..." />
      </label>
      <label className="text-xs text-ink-faint">
        source_type (§4a — bez izuzetka, samo ova tri)
        <select name="sourceType" defaultValue={SOURCE_TYPES[0]} className="input mt-1">
          {SOURCE_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm" className="self-start">
      {pending ? 'Dodajem…' : '+ predloži izvor'}
    </Button>
  );
}
