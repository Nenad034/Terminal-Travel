/**
 * M3 §2.11m — tip sobe kao šifarnik: poklapanje teksta iz dobavljačevog dokumenta sa šifrom
 * tipa sobe iz kataloga (`M2 Product.attributes.room_types[].code`, M2 §2.3a).
 *
 * Zašto uopšte: `ContractPeriod.room_type` je po šemi „konvencija ka `room_types[].code`, ne
 * strogi FK". Uvoz cenovnika je do sada upisivao **sirov tekst iz dokumenta** („Studio A2"), a
 * šifra sobe u katalogu je automatski generisan broj — dve vrednosti koje se ne poklapaju nikad.
 * Posledica je merena 10.9.2026: M5 pri prodaji ne nađe sobu i uzme kapacitet 99, pa se provera
 * kapaciteta tiho isključi (zamka 7.14). Poklapanje ovde je prvi korak koji to zatvara.
 *
 * **Namerno se NE koristi `normalizujNaziv` iz `hotel-matching.ts`:** ta funkcija izbacuje
 * pojedinačne cifre i „suvišne reči" jer kod naziva hotela smetaju. Kod tipa sobe cifra je
 * nosilac razlike — „Studio A2" i „Studio A3" su dve različite sobe, a „soba 2" i „soba 3"
 * takođe. Brisanje cifara bi ih spojilo u jedno.
 */

export interface KatalogSoba {
  code: string;
  name?: string | null;
}

export type NacinPoklapanja = 'SIFRA' | 'NAZIV' | 'DEO_NAZIVA';

export interface Poklapanje {
  code: string;
  nacin: NacinPoklapanja;
}

/** Mala slova, bez naših dijakritika, bez interpunkcije, jedan razmak — **cifre ostaju**. */
export function normalizujTipSobe(tekst: string): string {
  return tekst
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Tri stepena, od najpouzdanijeg ka najslabijem — i **staje čim nađe**, da slabiji stepen ne
 * može da pregazi jači:
 *
 *  1. `SIFRA` — tekst je već šifra iz kataloga (ručno unet period, ponovljen uvoz);
 *  2. `NAZIV` — tekst je ceo naziv sobe („Deluxe soba sa pogledom na more");
 *  3. `DEO_NAZIVA` — tekst je sadržan u nazivu (ili obrnuto), ali **isključivo kad pogađa tačno
 *     jednu sobu**. Kad „Studio" odgovara i „Studio A2" i „Studio A3", rezultat je `null`:
 *     dvosmislen slučaj ide čoveku, ne pogađa se. Isti princip kao ograda u §2.4a — sistem
 *     radije prijavi nego pretpostavi.
 */
export function poklopiTipSobe(tekst: string, sobe: KatalogSoba[]): Poklapanje | null {
  const t = normalizujTipSobe(tekst ?? '');
  if (t.length === 0) return null;

  const poSifri = sobe.find((s) => normalizujTipSobe(s.code) === t);
  if (poSifri) return { code: poSifri.code, nacin: 'SIFRA' };

  const poNazivu = sobe.filter((s) => s.name && normalizujTipSobe(s.name) === t);
  if (poNazivu.length === 1) return { code: poNazivu[0].code, nacin: 'NAZIV' };
  if (poNazivu.length > 1) return null; // dva ista naziva u katalogu — čovek bira

  const poDelu = sobe.filter((s) => {
    if (!s.name) return false;
    const n = normalizujTipSobe(s.name);
    return n.includes(t) || t.includes(n);
  });
  if (poDelu.length === 1) return { code: poDelu[0].code, nacin: 'DEO_NAZIVA' };

  return null;
}

export interface RezultatPoklapanja {
  /** Tekst iz dokumenta → šifra iz kataloga, za sve što je poklopljeno. */
  mapa: Map<string, Poklapanje>;
  /** Tekstovi koje katalog ne prepoznaje — svaki traži ljudsku odluku pre upisa. */
  nepoklopljeni: string[];
}

/**
 * Poklapanje celog spiska odjednom. Isti tekst se poklapa jednom bez obzira koliko redova
 * cenovnika ga nosi — čovek na ekranu odlučuje o TIPU SOBE, ne o svakom redu posebno.
 */
export function poklopiTipoveSoba(tekstovi: string[], sobe: KatalogSoba[]): RezultatPoklapanja {
  const mapa = new Map<string, Poklapanje>();
  const nepoklopljeni: string[] = [];
  for (const tekst of [...new Set(tekstovi.filter((t) => (t ?? '').trim().length > 0))]) {
    const p = poklopiTipSobe(tekst, sobe);
    if (p) mapa.set(tekst, p);
    else nepoklopljeni.push(tekst);
  }
  return { mapa, nepoklopljeni };
}
