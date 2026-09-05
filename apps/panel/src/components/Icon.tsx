// docs/analize/29-DIZAJN-SISTEM-UI.md §3a — Codicons (@vscode/codicons), jednobojne,
// prate boju teksta (currentColor preko CSS-a, ne sopstvena paleta).
export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  // `@vscode/codicons` nema glif za valutu (ni "euro" ni "currency") — jedini "finansijski"
  // glif je `credit-card`, semantički pogrešan za grupu "Prodaja" (5.9.2026, vlasnikov zahtev:
  // "umesto ikone lupe... stavite ikonu za EUR"). Prikazuje se doslovan znak €, veličinom/
  // linijskom visinom uparen sa `.codicon` (16px/1, §3a) da stoji ravnopravno pored ostalih
  // ikonica u istom redu (ActivityBar/gornja traka).
  if (name === 'euro') {
    return (
      <span
        className={`inline-block w-4 text-center font-sans text-[15px] font-semibold leading-4 ${className}`}
        aria-hidden="true"
      >
        €
      </span>
    );
  }
  return <span className={`codicon codicon-${name} ${className}`} aria-hidden="true" />;
}

/**
 * Dve iste ikonice, blago preklopljene — koristi se kad ne postoji jedinstven Codicon glif za
 * pojam koji treba prikazati (npr. "grupa ljudi": @vscode/codicons nema `people`/`group-people`,
 * samo `person` za jednu osobu). Dodato 5.9.2026 na zahtev vlasnika za "Putovanja" (grupni paket
 * sa vodičem, M5 spec §3.0d.6b) — dve `person` ikonice umesto jedne, da se razlikuje od
 * pojedinačnog "vodiča".
 */
export function IconDuo({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-hidden="true">
      <span className={`codicon codicon-${name}`} />
      <span className={`codicon codicon-${name} -ml-2`} />
    </span>
  );
}
