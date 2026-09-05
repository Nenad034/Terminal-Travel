'use client';

// Poslednja odbrana (5.9.2026, dok. 39 nalaz 2.5) — hvata grešku koja obori i sam korenski
// raspored (`app/layout.tsx`), gde `(app)/error.tsx` više ne može ništa jer ni ljuska panela
// ne postoji. Zato ovaj fajl mora sam da renderuje `<html>` i `<body>`.
//
// NAMERNO BEZ IJEDNE NAŠE KLASE I BEZ IJEDNE KOMPONENTE: u ovom stanju se ne sme računati ni
// na to da su CSS tokeni (`globals.css`) učitani ni da se `Icon`/`Button` mogu izvršiti — ako
// je greška baš u tom sloju, uvoz bi oborio i ovu stranicu, pa bi korisnik ostao na potpuno
// beloj strani. Stilovi su zato ugrađeni, a boje odabrane da budu čitljive i na svetloj i na
// tamnoj pozadini browsera.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="sr">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#1b1b1f', color: '#e6e6e6' }}>
        <div style={{ maxWidth: 640, margin: '10vh auto', padding: '0 24px' }}>
          <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Panel se nije učitao</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#b8b8b8', margin: '0 0 20px' }}>
            Greška je nastala pre nego što se aplikacija uopšte podigla, pa nije moguće prikazati uobičajen ekran.
            Vaši podaci nisu izgubljeni. Pokušajte ponovo; ako se ponovi, pošaljite oznaku ispod.
          </p>

          <button
            onClick={retry}
            style={{
              background: '#2f6f6a', color: '#fff', border: 0, borderRadius: 6,
              padding: '8px 14px', fontSize: 14, cursor: 'pointer',
            }}
          >
            pokušaj ponovo
          </button>
          {/* Obična adresa, ne `<Link>` — u ovom stanju se ne oslanjamo na router. */}
          <a
            href="/"
            style={{
              display: 'inline-block', marginLeft: 8, padding: '8px 14px', fontSize: 14,
              color: '#e6e6e6', border: '1px solid #444', borderRadius: 6, textDecoration: 'none',
            }}
          >
            na početnu
          </a>

          <div style={{ marginTop: 24, padding: 12, border: '1px solid #333', borderRadius: 6, fontSize: 12 }}>
            <div style={{ color: '#8f8f8f', marginBottom: 4 }}>Oznaka za prijavu:</div>
            <code style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest ?? 'nije dodeljena'}</code>
          </div>
        </div>
      </body>
    </html>
  );
}
