import type { CSSProperties } from 'react';

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
      {/* Gornje T: gornja greda + gornji deo stuba, staje PRE sredine.
          Debljina +20% (18.9.2026, vlasnikov zahtev) — greda 10→12 (spoljna ivica na y=-55
          fiksna, deblja ka unutra), stub 8→9.6 (centriran, x pomeren sa -4 na -4.8). Visina
          stuba (48, do y=-7) i sam razmak u sredini NISU dirani — samo debljina linije. */}
      <rect x="-32" y="-55" width="64" height="12" fill="var(--brand)" />
      <rect x="-4.8" y="-55" width="9.6" height="48" fill="var(--brand)" />
      {/* Donje obrnuto T: donji deo stuba + donja greda, počinje POSLE sredine — prazan razmak
          između y=-7 i y=7 (14px u ovom viewBox-u) je NAMERAN, to je "linija bez boje".
          Ista +20% debljina, simetrično: greda spoljna ivica na y=55 fiksna. */}
      <rect x="-4.8" y="7" width="9.6" height="48" fill="var(--brand)" />
      <rect x="-32" y="43" width="64" height="12" fill="var(--brand)" />
    </svg>
  );
}

/* Linija "bez boje" kroz reči (18.9.2026, vlasnikov zahtev: "radi dinamike... kroz obe reči u
   pravcu praznine između obrnuta dva slova T provuci liniju bez boje... tanka linija") — produžava
   isti vizuelni jezik kao STVARNI prazan razmak u `TSymbol` (§ komentar iznad, y=-7 do 7, tačno
   vertikalni centar) na tekst "erminal"/"ravel". Reč "bez boje" je namerno uzeta doslovno: ovo NIJE
   farbana linija (ne bi radila na dve različite pozadine — tamna slika na `/prijava`, `--bar` u
   TopBar-u), nego CSS `mask-image` koja STVARNO izbacuje piksele u tankoj traci tačno na sredini
   reda — kroz nju se vidi šta god je iza, isto ponašanje kao fizički razmak u SVG simbolu, samo
   primenjeno na font (gde se pravi geometrijski prekid ne može napraviti bez konverzije u path).
   `mask-image` (ne SVG `<mask>` element) — vlasnik je 5.9.2026 eksplicitno odbio providnu SVG
   masku za T simbol ("ne vidi se tako"); ovo je druga tehnika (CSS maska na DOM elementu, ne SVG
   masking element), pa taj raniji nalaz ovde ne važi automatski — potvrđeno uživo da radi.
   ISPRAVKA (18.9.2026, isti dan) — prvobitna traka od 2px ("1px iznad + 1px ispod centra") je na
   stvarnoj veličini slova "pojela" tanje delove glifa (vlasnikov nalaz), pa je smanjena na 1px
   ukupno (0.5px + 0.5px). */
const wordGapMaskStyle: CSSProperties = {
  WebkitMaskImage:
    'linear-gradient(to bottom, #000 0, #000 calc(50% - 0.5px), transparent calc(50% - 0.5px), transparent calc(50% + 0.5px), #000 calc(50% + 0.5px), #000 100%)',
  maskImage:
    'linear-gradient(to bottom, #000 0, #000 calc(50% - 0.5px), transparent calc(50% - 0.5px), transparent calc(50% + 0.5px), #000 calc(50% + 0.5px), #000 100%)',
};

/** Pun logotip — "[T][T]erminal [T][T]ravel", za proširenu gornju traku (`TopBar.tsx`). */
export function BrandLogoFull({ heightPx }: { heightPx: number }) {
  const textStyle = { color: 'var(--brand)', ...wordGapMaskStyle };
  // Visina teksta +20% (18.9.2026, vlasnikov zahtev, isti prolaz kao stanjivanje linije iznad) —
  // 0.7 → 0.84 od heightPx (T simbol i razmak u njemu ostaju nepromenjeni, ovo dira SAMO tekst).
  const textFontSize = heightPx * 0.84;
  return (
    <span className="flex flex-shrink-0 items-center">
      <TSymbol heightPx={heightPx} />
      <span
        className="font-brand truncate font-bold tracking-wide"
        style={{ ...textStyle, fontSize: textFontSize }}
      >
        erminal
      </span>
      <TSymbol heightPx={heightPx} className="ml-1.5" />
      <span
        className="font-brand truncate font-bold tracking-wide"
        style={{ ...textStyle, fontSize: textFontSize }}
      >
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
