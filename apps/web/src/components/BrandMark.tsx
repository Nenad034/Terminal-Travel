// Logo agencije, IDENTIČAN panelovom (8.9.2026, vlasnikov zahtev: "logo agencije na sajtu
// treba da bude identičan onom u aplikaciji") — kopija `apps/panel/src/components/BrandMark.tsx`.
// Nije deljena komponenta preko granice apps/panel ↔ apps/web (odvojene Next aplikacije, princip
// #2 "moduli su granice" važi i za frontend kanale) — ista definicija na dva mesta, namerno.
//
// Simbol: dva "T" oblika — gornje T i donje obrnuto T — sa STVARNIM praznim razmakom u sredini
// stuba. Simbol ZAMENJUJE veliko slovo "T" na početku obe reči: [simbol]+"erminal" čita se
// "Terminal", [simbol]+"ravel" čita se "Travel". Boja `--brand` — fiksna narandžasta (sajt sad
// ima samo svetli mod, isti razlog kao panel: brend znak se ne menja sa temom).
//
// VAŽNO ograničenje (isto kao u panelu): ovo je hardkodiran pun na REČIMA "Terminal"/"Travel",
// ne izvedeno iz `AgencySettings.brandName` — za razliku od `Footer.tsx` (tekstualni wordmark),
// ovaj simbol se NE menja automatski ako se naziv agencije promeni. Panel ima istu osobinu.
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
      <rect x="-32" y="-55" width="64" height="10" fill="var(--brand)" />
      <rect x="-4" y="-55" width="8" height="48" fill="var(--brand)" />
      <rect x="-4" y="7" width="8" height="48" fill="var(--brand)" />
      <rect x="-32" y="45" width="64" height="10" fill="var(--brand)" />
    </svg>
  );
}

/** Pun logotip — "[T][T]erminal [T][T]ravel". */
export function BrandLogoFull({ heightPx }: { heightPx: number }) {
  const textStyle = { color: 'var(--brand)' };
  return (
    <span className="flex flex-shrink-0 items-center">
      <TSymbol heightPx={heightPx} />
      <span
        className="font-brand truncate font-bold tracking-wide"
        style={{ ...textStyle, fontSize: heightPx * 0.7 }}
      >
        erminal
      </span>
      <TSymbol heightPx={heightPx} className="ml-1.5" />
      <span
        className="font-brand truncate font-bold tracking-wide"
        style={{ ...textStyle, fontSize: heightPx * 0.7 }}
      >
        ravel
      </span>
    </span>
  );
}
