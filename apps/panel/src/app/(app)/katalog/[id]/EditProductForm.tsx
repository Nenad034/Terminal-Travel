'use client';

import { useEffect } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateProductTranslation, FormState } from '../actions';
import { usePathname } from 'next/navigation';
import { useTabs } from '@/components/TabsContext';

const initialState: FormState = { error: null };

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — "indikator nesačuvane izmene": tab dobija
// tačku dok je forma dirty (onChange bez uspešnog submit-a).
export default function EditProductForm({
  productId,
  translation,
}: {
  productId: string;
  translation?: { name: string; description: string; slug: string };
}) {
  const [state, formAction] = useFormState(updateProductTranslation, initialState);
  const pathname = usePathname();
  const { markDirty } = useTabs();

  useEffect(() => {
    if (!state.error) markDirty(pathname, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      onChange={() => markDirty(pathname, true)}
      className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-5"
    >
      <input type="hidden" name="id" value={productId} />
      {state.error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{state.error}</p>}

      <label className="text-xs text-ink-faint">
        naziv (srpski)
        <input name="name" defaultValue={translation?.name} required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        opis (srpski)
        <textarea name="description" defaultValue={translation?.description} rows={4} required className="input mt-1" />
      </label>
      <label className="text-xs text-ink-faint">
        slug
        <input name="slug" defaultValue={translation?.slug} required className="input mt-1" />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
    >
      {pending ? 'Čuvanje…' : 'Sačuvaj izmene'}
    </button>
  );
}
