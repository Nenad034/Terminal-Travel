import Link from 'next/link';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';

// Nalaz 2.5 (dok. 39) — 404 stranica na srpskom umesto Next-ove engleske podrazumevane.
//
// Ranija proba (5.9.2026) je pravila IDENTIČAN fajl i on se nije aktivirao ni u dev ni u
// produkciji — po Next-ovoj dokumentaciji (`node_modules/next/dist/docs/.../not-found.md`,
// "v13.0.0 — Root app/not-found handles global unmatched URLs") koren `app/not-found.tsx` bi
// trebalo da hvata SVAKU neupoznatu adresu bez ikakvog dodatnog prekidača — `globalNotFound`
// (experimental) postoji samo za projekte sa VIŠE korenskih rasporeda ili dinamičkim
// segmentima na vrhu stabla, što ovaj panel nema (jedan `app/layout.tsx`, bez `[param]`
// segmenta na vrhu). Prethodni pokušaj nije ostavio trag zašto tačno nije proradio — ovaj put
// je provereno uživo, u pravom produkcijskom buildu (`next build && next start`), ne
// pretpostavljeno iz koda (dok. 40, pravilo 3).
//
// Renderuje se BEZ ljuske panela (leva traka/tabovi) — za razliku od `(app)/error.tsx`, ovaj
// fajl stoji u korenu `app/`, pa hvata i adrese koje uopšte nisu pod `(app)` grupom (npr.
// otkucana greška van svih poznatih putanja). Ipak koristi globals.css tokene, jer se
// renderuje UNUTAR korenskog `app/layout.tsx` (za razliku od `global-error.tsx`, koji taj
// raspored zaobilazi).
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-panel p-6 text-center">
        <div className="mb-3 flex items-center justify-center gap-2 text-ink-dim">
          <Icon name="search" />
          <h1 className="text-base font-semibold text-ink">Stranica nije pronađena</h1>
        </div>

        <p className="mb-4 text-sm text-ink-dim">
          Adresa na koju ste stigli ne postoji u panelu — možda je link zastareo ili je greška u kucanju.
        </p>

        <Button asChild size="sm" variant="outline" className="mx-auto">
          <Link href="/" className="flex items-center gap-1.5">
            <Icon name="home" /> na početnu
          </Link>
        </Button>
      </div>
    </div>
  );
}
