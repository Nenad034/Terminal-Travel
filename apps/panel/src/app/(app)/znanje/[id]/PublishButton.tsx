'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { publishArticle, FormState } from '../actions';

const initialState: FormState = { error: null };

// M23 spec §2.1/§6/§8 — POST /knowledge/articles/:id/publish, isključivo Vlasnik/Direktor/Sales
// Manager (M23/article/PUBLISH), nikad AI_AGENT — sprovedeno na nivou koda (assertHumanActor),
// ova strana samo krije dugme kad pozivalac nema dozvolu. Nepovratna granica (generiše
// share_token pri prvom prelasku), sopstveno dugme, ne deo druge forme.
export default function PublishButton({ id }: { id: string }) {
  const boundAction = publishArticle.bind(null, id);
  const [state, formAction] = useFormState(boundAction, initialState);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <Btn />
      {state.error && <span className="text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Objavljujem…' : 'objavi (nepovratno)'}
    </button>
  );
}
