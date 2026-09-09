import { MONTH_NAMES } from '@/components/DateField';

// 9.9.2026 — `toLocaleDateString('sr-RS', { month: 'long' })` vraća ĆIRILICU („август 2026."),
// jer je to podrazumevano pismo za `sr-RS` u ICU bazi koju Node/browser nosi. Ceo panel je
// latinica, pa se to na ekranu vidi kao strano telo. Zatečeno na zaglavlju mreže kapaciteta
// (M17 §4b.1) i, istim pretragom, na još dva mesta — sve tri prelaze ovde.
//
// Traženje latinice preko `sr-Latn-RS` NIJE rešenje: ta oznaka nije podržana u svakoj ICU
// varijanti (Node build bez punog ICU tiho pada na engleski), pa bi ispis zavisio od toga kako
// je Node preveden. Nazivi se zato ispisuju iz `MONTH_NAMES` (`DateField.tsx`) — istog spiska
// koji već stoji u kalendaru panela, da se dva mesta ne raziđu.
//
// Isključivo za nazive meseca/dana. Čisto BROJČANI ispisi (`toLocaleDateString('sr-RS')` →
// „25.8.2026.") nemaju ovaj problem i namerno ostaju kakvi jesu.

const DANI_U_NEDELJI = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];

/** „avgust 2026" — za zaglavlja koja grupišu dane po mesecu. */
export function mesecGodina(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** „sreda, 9. septembar 2026." — pun datum, kako se piše u panelu. */
export function punDatum(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DANI_U_NEDELJI[d.getUTCDay()]}, ${d.getUTCDate()}. ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}.`;
}
