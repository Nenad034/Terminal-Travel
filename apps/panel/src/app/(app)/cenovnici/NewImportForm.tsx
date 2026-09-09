'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import { createImport, type UvozFormState } from './actions';

const pocetno: UvozFormState = { error: null, ok: null };

// M3 spec §4.2.6 — prvi prolaz uvozi NALEPLJEN TEKST, ne fajl.
//
// Nije skraćenje nego posledica: `source_file_url` pretpostavlja EU cloud skladište koje još
// nije izabrano (ista odluka koju `docker-compose.yml` namerno drži otvorenom). Dobavljači
// cenovnike najčešće šalju mejlom, pa je nalepljen sadržaj mejla realan ulaz koji ne traži
// nijednu novu infrastrukturu — i radi danas, a ne kad se odluči o skladištu.
export default function NewImportForm({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createImport, pocetno);
  const [otvoren, setOtvoren] = useState(false);

  if (!otvoren) {
    return (
      <Button onClick={() => setOtvoren(true)} size="sm" className="self-start">
        <Icon name="add" /> Nov uvoz cenovnika
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Nov uvoz cenovnika</h2>
        <button
          type="button"
          onClick={() => setOtvoren(false)}
          className="text-[11px] text-ink-faint hover:underline"
        >
          zatvori
        </button>
      </div>

      {state.error && (
        <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{state.error}</p>
      )}

      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Dobavljač
        <select name="supplierId" required className="input" defaultValue="">
          <option value="" disabled>
            — izaberite dobavljača —
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
        Nalepite cenovnik (tekst iz mejla ili dokumenta)
        <textarea
          name="sourceText"
          required
          rows={10}
          minLength={20}
          className="input font-mono text-xs"
          placeholder={
            'CENOVNIK 2027 — Hotel Splendid, Bečići\n\nPeriod: 01.06.2027 — 30.06.2027\nDBL, noćenje sa doručkom: 89,50 EUR po sobi/noć\nDete 2–11,99 uz dve odrasle osobe: 50%\n…'
          }
        />
      </label>

      <p className="rounded bg-sunken p-2 text-[10px] text-ink-faint">
        Učitavanje PDF/Excel fajla još nije podržano — čeka odluku o skladištu dokumenata (M3
        §4.2.6). Za skenirane cenovnike prekopirajte tekst ručno.
      </p>

      <Posalji />
    </form>
  );
}

function Posalji() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="self-start">
      {pending ? 'AI čita cenovnik…' : 'Uvezi i pusti AI da pročita'}
    </Button>
  );
}
