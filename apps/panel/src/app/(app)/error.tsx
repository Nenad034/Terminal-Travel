'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';

// Stranica greške za SVE ekrane panela (5.9.2026, dok. 39 nalaz 2.5).
//
// ZAŠTO POSTOJI: do danas u `apps/panel` nije bilo nijednog `error.tsx`. Svaka greška u
// prikazu — kao ona sa `base_beds` koja je vlasniku pukla na ekranu — davala je golu
// Next.js stranicu: bez poruke na srpskom, bez „pokušaj ponovo", i bez ijednog podatka koji
// bi se mogao proslediti dalje. Za internu aplikaciju u kojoj agent sedi na telefonu sa
// gostom to je razlika između „osveži i nastavi" i „zovi Nenada".
//
// Stoji unutar `(app)` grupe, pa se prikazuje UNUTAR ljuske panela — leva traka, tabovi i
// meni ostaju, kvari se samo sadržaj tog jednog ekrana. Bez toga bi jedna greška u tabeli
// oborila ceo panel i korisnik ne bi imao ni kuda da klikne.
//
// U Next 16 se svojstvo za ponovni pokušaj zove `retry`, NE `reset` kao u ranijim verzijama
// (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`). Pogrešno
// ime ne prijavljuje ni `tsc` ni `build` — dugme prosto ne bi radilo. Zato `apps/panel/AGENTS.md`
// i traži da se uputstvo te verzije pročita pre pisanja koda.
//
// `digest` je oznaka koju Next.js sam dodeljuje serverskoj grešci i pod kojom je PUN trag
// (poruka + stack) već upisan u log servera. Prikazuje se namerno: to je jedina nit koja
// spaja ono što korisnik vidi sa onim što piše u logu. Slanje greške u M18 nadzor traži nov
// endpoint (`HealthSignal` danas ima samo `GET`) i dopunu M18 spec-a — svesno van ovog
// prolaza, zavedeno kao poznat nedostatak.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Vidljivo u konzoli browsera pri dijagnostici; sam Next već loguje serversku stranu.
    console.error('[panel] greška na ekranu:', error);
  }, [error]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-panel p-6">
        <div className="mb-3 flex items-center gap-2 text-danger">
          <Icon name="warning" />
          <h1 className="text-base font-semibold">Ovaj ekran nije uspeo da se prikaže</h1>
        </div>

        <p className="mb-4 text-sm text-ink-dim">
          Greška je zabeležena. Vaši podaci nisu izgubljeni — ništa nije upisano niti obrisano zbog ovoga.
          Pokušajte ponovo; ako se ponovi, pošaljite oznaku ispod da bismo tačno znali šta se desilo.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={retry} className="flex items-center gap-1.5">
            <Icon name="refresh" /> pokušaj ponovo
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/" className="flex items-center gap-1.5">
              <Icon name="home" /> na početnu
            </Link>
          </Button>
        </div>

        {/* Oznaka je jedini pouzdan način da se prijavljena greška poveže sa tragom u logu.
            Bez nje prijava glasi „nešto je puklo negde", što ne pomaže nikome. */}
        <div className="rounded border border-border bg-panel2 p-3 text-xs">
          <div className="mb-1 text-ink-faint">Oznaka za prijavu:</div>
          <code className="font-mono text-ink">{error.digest ?? 'nije dodeljena (greška u browseru, ne na serveru)'}</code>
          {error.message && (
            <>
              <div className="mb-1 mt-2 text-ink-faint">Tehnički opis:</div>
              <code className="block whitespace-pre-wrap break-words font-mono text-ink-dim">{error.message}</code>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
