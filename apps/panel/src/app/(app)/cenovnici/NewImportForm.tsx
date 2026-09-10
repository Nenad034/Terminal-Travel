'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/Icon';
import { createImport, uploadImport, type UvozFormState } from './actions';

const pocetno: UvozFormState = { error: null, ok: null };

// M3 spec §4.2.6 (nalepljen tekst) i §4.2.7 (fajl, v1.36 — vlasnikova odluka 10.9.2026 da se
// dokumenti čuvaju na lokalnom disku).
//
// DVA RAVNOPRAVNA ULAZA, ne jedan sa alternativom: dobavljači šalju i jedno i drugo, a nijedan
// od ta dva puta nije „napredni" — nalepljen tekst iz mejla je najčešći, fajl je neizbežan kod
// skeniranih cenovnika. Prikazani su kao dve kartice da izbor bude vidljiv pre nego što čovek
// počne da popunjava.
const PODRZANI_FORMATI = '.pdf,.xlsx,.docx,.html,.htm,.csv,.txt,.md,.jpg,.jpeg,.png,.webp';
export default function NewImportForm({
  suppliers,
}: {
  suppliers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createImport, pocetno);
  const [uploadState, uploadAction] = useActionState(uploadImport, pocetno);
  const [otvoren, setOtvoren] = useState(false);
  const [nacin, setNacin] = useState<'tekst' | 'fajl'>('tekst');

  if (!otvoren) {
    return (
      <Button onClick={() => setOtvoren(true)} size="sm" className="self-start">
        <Icon name="add" /> Nov uvoz cenovnika
      </Button>
    );
  }

  const dobavljacPolje = (
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
  );

  const greska = nacin === 'tekst' ? state.error : uploadState.error;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-panel p-4">
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

      <div className="flex gap-1" role="tablist">
        {(
          [
            ['tekst', 'Nalepi tekst'],
            ['fajl', 'Učitaj fajl'],
          ] as const
        ).map(([vrednost, naziv]) => (
          <button
            key={vrednost}
            type="button"
            role="tab"
            aria-selected={nacin === vrednost}
            onClick={() => setNacin(vrednost)}
            className={
              nacin === vrednost
                ? 'rounded border border-border bg-sunken px-3 py-1 text-[11px] font-semibold text-ink'
                : 'rounded border border-transparent px-3 py-1 text-[11px] text-ink-faint hover:text-ink'
            }
          >
            {naziv}
          </button>
        ))}
      </div>

      {greska && <p className="rounded bg-danger-bg p-2 text-[11px] text-danger">{greska}</p>}

      {nacin === 'tekst' ? (
        <form action={formAction} className="flex flex-col gap-3">
          {dobavljacPolje}
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
          <Posalji naziv="Uvezi i pusti AI da pročita" />
        </form>
      ) : (
        <form action={uploadAction} className="flex flex-col gap-3">
          {dobavljacPolje}
          <label className="flex flex-col gap-1 text-[11px] text-ink-faint">
            Cenovnik kao fajl
            <input
              type="file"
              name="file"
              required
              accept={PODRZANI_FORMATI}
              className="input text-xs"
            />
          </label>
          {/*
            Spisak i granica stoje NA EKRANU, ne samo u proveri na serveru: fajl koji bude
            odbijen posle učitavanja je izgubljeno vreme, a poruka „tip nije podržan" bez spiska
            ne kaže čoveku šta da uradi.
          */}
          <p className="rounded bg-sunken p-2 text-[10px] text-ink-faint">
            PDF (i skeniran), Excel, Word, HTML, CSV, slika. Najviše 25 MB. Skenirani dokument i
            fotografiju čita AI direktno — ne treba ništa prekucavati.
          </p>
          <Posalji naziv="Učitaj i pusti AI da pročita" />
        </form>
      )}
    </div>
  );
}

function Posalji({ naziv }: { naziv: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending} className="self-start">
      {pending ? 'AI čita cenovnik…' : naziv}
    </Button>
  );
}
