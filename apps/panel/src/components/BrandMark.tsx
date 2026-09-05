// Novi logotip (5.9.2026, vlasnikova ideja, potvrđena preko nekoliko vizuelnih iteracija) —
// zamenjuje raniji `terminal-travel-icon-v2.svg` + "terminal travel" natpis (26.8.2026).
//
// Simbol: dva "T" oblika — gornje T i donje obrnuto T — sa STVARNIM praznim razmakom u sredini
// stuba (ne obojena linija preko njega; vlasnik je eksplicitno odbio i obojenu liniju kroz
// sredinu i providnu SVG masku — "ne vidi se tako" — pravi geometrijski prekid u obliku je
// jedina verzija koju je potvrdio). Ovaj simbol ZAMENJUJE veliko slovo "T" na početku obe reči:
// [simbol]+"erminal" čita se "Terminal", [simbol]+"ravel" čita se "Travel". Sve narandzasto
// (`--brand`, globals.css) — FIKSNO u sva tri moda (svetli/dim/tamni), isti princip kao linije
// tabova (`--tab-line`) uveden istog dana.
//
// `TSymbol` je čist SVG (ne mask-image tehnika kao raniji `terminal-travel-icon-v2.svg`) — nema
// razloga za mask-image kad je oblik već monohromatski i boja fiksna, čist SVG je jednostavniji.
function TSymbol({ heightPx, className }: { heightPx: number; className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={(heightPx * 64) / 110}
      height={heightPx}
      viewBox="-32 -55 64 110"
      className={`flex-shrink-0 ${className ?? ''}`}
    >
      {/* Gornje T: gornja greda + gornji deo stuba, staje PRE sredine. */}
      <rect x="-32" y="-55" width="64" height="10" fill="var(--brand)" />
      <rect x="-4" y="-55" width="8" height="48" fill="var(--brand)" />
      {/* Donje obrnuto T: donji deo stuba + donja greda, počinje POSLE sredine — prazan razmak
          između y=-7 i y=7 (14px u ovom viewBox-u) je NAMERAN, to je "linija bez boje". */}
      <rect x="-4" y="7" width="8" height="48" fill="var(--brand)" />
      <rect x="-32" y="45" width="64" height="10" fill="var(--brand)" />
    </svg>
  );
}

/** Pun logotip — "[T][T]erminal [T][T]ravel", za proširenu gornju traku (`TopBar.tsx`). */
export function BrandLogoFull({ heightPx }: { heightPx: number }) {
  const textStyle = { color: 'var(--brand)' };
  return (
    <span className="flex flex-shrink-0 items-center">
      <TSymbol heightPx={heightPx} />
      <span className="font-brand truncate font-bold tracking-wide" style={{ ...textStyle, fontSize: heightPx * 0.7 }}>
        erminal
      </span>
      <TSymbol heightPx={heightPx} className="ml-1.5" />
      <span className="font-brand truncate font-bold tracking-wide" style={{ ...textStyle, fontSize: heightPx * 0.7 }}>
        ravel
      </span>
    </span>
  );
}

/** Skraćena verzija — samo dva T simbola, bez reči (5.9.2026, vlasnikov zahtev: "napravite
 * skraćen logo koji će da se pojavljuje kada se skupi levi panel, približi ova dva slova T,
 * ukloni reči"). Koristi se u `TopBar.tsx` kad je bočna traka skupljena/uska (`!showLabel`). */
export function BrandLogoShort({ heightPx }: { heightPx: number }) {
  return (
    <span className="flex flex-shrink-0 items-center gap-0.5">
      <TSymbol heightPx={heightPx} />
      <TSymbol heightPx={heightPx} />
    </span>
  );
}
