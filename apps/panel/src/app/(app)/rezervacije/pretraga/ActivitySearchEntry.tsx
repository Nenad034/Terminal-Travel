'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { searchDestinationsByActivity, type ActivityDestinationResult } from './actions';
import { ACTIVITY_LABELS, type ActivityTag } from '../../katalog/destinacije/DestinationProfilesEditor';

// M5 spec §3.0c.3e (dopuna 5.9.2026) — "Nov, alternativan ulaz u pretragu": gost/agent bira
// aktivnost, sistem vraća destinacije čiji `DestinationProfile.activities[]` je sadrži, klik na
// destinaciju predfiltrira postojeći geografski tok (§3.0c.2). Za razliku od ostatka ekrana
// pretrage (mock, §3.0b.2), OVO je stvarno ožičeno — backend endpoint postoji i radi (commit
// 351b2fd) — isto što je vlasnikov zadatak izričito dozvolio kao jedini deo koji sme biti živ
// bez čekanja na potpunu žicu §3.0b.2.
//
// "Namerno van obima ovog prolaza" (§3.0c.3e): tačan izgled ovog ulaznog ekrana na M17/M8 — ovo
// je prvi, jednostavan oblik (dugme + padajuća lista rezultata), ne konačan dizajn.
export default function ActivitySearchEntry() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityTag | null>(null);
  const [results, setResults] = useState<ActivityDestinationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pick(tag: ActivityTag) {
    setActivity(tag);
    setResults(null);
    setError(null);
    startTransition(async () => {
      const res = await searchDestinationsByActivity(tag);
      if (res.error) setError(res.error);
      else setResults(res.results);
    });
  }

  function goToDestination(d: ActivityDestinationResult) {
    const params = new URLSearchParams();
    params.set('destinationCountry', d.destinationCountry);
    params.set('destinationCity', d.destinationCity);
    params.append('type', 'ACCOMMODATION');
    setOpen(false);
    router.push(`/rezervacije/pretraga?${params.toString()}`);
  }

  return (
    <div className="relative mb-3">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5">
        <Icon name="compass" /> Pretraga po aktivnosti
      </Button>

      {open && (
        <div className="absolute z-40 mt-1 w-96 rounded-lg border border-border bg-panel p-3 text-xs shadow-sm">
          <p className="mb-2 text-ink-faint">Izaberite aktivnost — sistem predlaže destinacije koje je podržavaju (M5 spec §3.0c.3e).</p>
          <div className="mb-3 flex flex-wrap gap-1">
            {(Object.keys(ACTIVITY_LABELS) as ActivityTag[]).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => pick(tag)}
                aria-pressed={activity === tag}
                className={`rounded border px-2 py-0.5 ${
                  activity === tag ? 'border-accent bg-accent-soft text-accent-strong' : 'border-border text-ink-dim hover:border-accent hover:text-ink'
                }`}
              >
                {ACTIVITY_LABELS[tag]}
              </button>
            ))}
          </div>

          {pending && <p className="text-ink-faint">Pretraga…</p>}
          {error && <p className="rounded bg-danger-bg p-2 text-danger">{error}</p>}
          {!pending && !error && results && results.length === 0 && (
            <p className="text-ink-faint">Nijedna destinacija još nema profil sa ovom aktivnošću.</p>
          )}
          {!pending && results && results.length > 0 && (
            <ul className="flex flex-col gap-1">
              {results.map((d) => (
                <li key={`${d.destinationCountry}/${d.destinationCity}`}>
                  <button
                    type="button"
                    onClick={() => goToDestination(d)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-panel2"
                  >
                    <span className="text-ink">
                      {d.destinationCity}, {d.destinationCountry}
                    </span>
                    {d.excursionCount > 0 && <span className="text-ink-faint">{d.excursionCount} izleta</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
