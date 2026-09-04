'use client';

import { useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import { updateProduct, FormState } from '../actions';
import { usePathname } from 'next/navigation';
import { useTabs } from '@/components/TabsContext';
import { Button } from '@/components/ui/button';

const initialState: FormState = { error: null };

// docs/analize/29-DIZAJN-SISTEM-UI.md §5a — "indikator nesačuvane izmene": tab dobija
// tačku dok je forma dirty (onChange bez uspešnog submit-a).
export default function EditProductForm({
  productId,
  translation,
  destination,
}: {
  productId: string;
  translation?: { name: string; description: string; slug: string };
  destination: { destinationCountry: string; destinationCity: string; destinationArea: string | null };
}) {
  const [state, formAction] = useActionState(updateProduct, initialState);
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
      <label className="text-xs text-ink-faint">
        država odredišta
        <input name="destinationCountry" defaultValue={destination.destinationCountry} required className="input mt-1" />
      </label>
      {/* M2 spec §2.1b (4.9.2026) — isti par polja kao NewProductForm: mesto mora biti stvarno
          naselje, regija/poluostrvo (kad postoji) ide odvojeno, ne u isto polje. Ovo je jedino
          mesto gde se zatečeni pogrešan unos (npr. "Sitonija, Halkidiki" u polju mesto) može
          ispraviti — ranije nije postojala forma za izmenu ovih polja na postojećem proizvodu. */}
      <label className="text-xs text-ink-faint">
        mesto odredišta
        <input name="destinationCity" defaultValue={destination.destinationCity} required className="input mt-1" placeholder="Nikiti" />
      </label>
      <label className="text-xs text-ink-faint">
        regija / poluostrvo (opciono)
        <input name="destinationArea" defaultValue={destination.destinationArea ?? ''} className="input mt-1" placeholder="Sitonija, Halkidiki" />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="mt-1 self-start">
      {pending ? 'Čuvanje…' : 'Sačuvaj izmene'}
    </Button>
  );
}
