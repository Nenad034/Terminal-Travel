/**
 * M3 spec §4.2.3 — poklapanje naziva hotela iz dokumenta sa M2 katalogom.
 *
 * ZAŠTO KOD, A NE MODEL (§4.2.6): Levenštajnova distanca je deterministična — isti unos daje
 * isti rezultat svaki put, i može se objasniti brojem. Model bi isti naziv poklapao različito iz
 * poziva u poziv, a ovde greška znači cenu upisanu na pogrešan hotel.
 */

/** Klasična Levenštajnova distanca, dva reda matrice umesto pune (dovoljno za kratke nazive). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prethodni = Array.from({ length: b.length + 1 }, (_, i) => i);
  let tekuci = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    tekuci[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cena = a[i - 1] === b[j - 1] ? 0 : 1;
      tekuci[j] = Math.min(tekuci[j - 1] + 1, prethodni[j] + 1, prethodni[j - 1] + cena);
    }
    [prethodni, tekuci] = [tekuci, prethodni];
  }
  return prethodni[b.length];
}

/**
 * Naziv se svodi na oblik u kom se porede samo slova i cifre, malim slovima, bez dijakritike i
 * bez reči koje ne razlikuju objekte („hotel", „resort", zvezdice).
 *
 * Bez ovoga „Hotel Splendid 5*" i „SPLENDID" ispadaju kao dva različita objekta, iako je razlika
 * isključivo u onome što u nazivu ništa ne znači.
 */
const SUVISNE_RECI = new Set([
  'hotel',
  'hoteli',
  'resort',
  'apartments',
  'apartmani',
  'villa',
  'vila',
  'spa',
  'wellness',
  'the',
]);

export function normalizujNaziv(naziv: string): string {
  return (
    naziv
      // `đ`/`Đ` (U+0111/U+0110) su SAMOSTALNA slova, ne slovo sa dodatim znakom — `normalize('NFD')`
      // ih ne rastavlja, pa bi ih filter ispod obrisao i „Đerdap" bi postao „erdap". Ostala naša
      // slova (č, ć, ž, š) NFD uredno rastavlja. Zatečeno testom 9.9.2026.
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((r) => r.length > 0 && !SUVISNE_RECI.has(r) && !/^\d$/.test(r))
      .join(' ')
  );
}

/** 0–100. Ista dužina i nula razlika = 100; razlika veličine naziva = 0. */
function ocena(a: string, b: string): number {
  const na = normalizujNaziv(a);
  const nb = normalizujNaziv(b);
  if (na.length === 0 || nb.length === 0) return 0;
  if (na === nb) return 100;
  const d = levenshtein(na, nb);
  const max = Math.max(na.length, nb.length);
  return Math.max(0, Math.round((1 - d / max) * 100));
}

/**
 * Cenovnici redovno lepe mesto uz naziv — „HOTEL SPLENDID, Bečići". Zatečeno 9.9.2026 na prvom
 * stvarnom pozivu modela: poklapanje sa kataloškim „Hotel Splendid" palo je na 53%, dakle duboko
 * ispod praga, iako je reč o istom objektu.
 *
 * Zato se poredi i CEO naziv i njegov deo pre prvog zareza, pa se uzima bolji rezultat. Namerno
 * se ne odbacuje deo posle zareza unapred: kod nekih objekata je to deo imena („Splendid, Conference
 * & Spa"), pa bi tvrdo odsecanje pravilo suprotnu grešku.
 */
export function slicnost(a: string, b: string): number {
  const varijante = (x: string) => {
    const pre = x.split(',')[0];
    return pre !== x ? [x, pre] : [x];
  };
  let najbolja = 0;
  for (const va of varijante(a)) {
    for (const vb of varijante(b)) {
      najbolja = Math.max(najbolja, ocena(va, vb));
    }
  }
  return najbolja;
}

export const PRAG_AUTOMATSKOG_POKLAPANJA = 85;

export interface KandidatProizvod {
  id: string;
  destinationCity: string;
  destinationCountry: string;
  naziv: string;
}

/**
 * §4.2.3 — najbolji kandidat, filtriran po destinaciji radi smanjenja lažnih poklapanja.
 *
 * Vraća kandidata I POD pragom, sa svojom ocenom: red ispod praga ne dobija automatsko
 * mapiranje (`matchedProductId` ostaje prazan), ali čovek na ekranu vidi šta je bilo najbliže —
 * spisak bez ijednog predloga tera ga da sam traži kroz ceo katalog.
 */
export function nadjiNajbolji(
  hotelIzDokumenta: string,
  kandidati: KandidatProizvod[],
  destinacija?: { city?: string | null; country?: string | null },
): { kandidat: KandidatProizvod; ocena: number } | null {
  const suzeni = destinacija?.city
    ? kandidati.filter(
        (k) => normalizujNaziv(k.destinationCity) === normalizujNaziv(destinacija.city!),
      )
    : kandidati;
  // Ako sužavanje po mestu ne ostavi nikoga, gleda se ceo katalog — bolje predlog uz nižu ocenu
  // nego nijedan predlog zato što je mesto u dokumentu drugačije napisano.
  const skup = suzeni.length > 0 ? suzeni : kandidati;

  let najbolji: { kandidat: KandidatProizvod; ocena: number } | null = null;
  for (const k of skup) {
    const ocena = slicnost(hotelIzDokumenta, k.naziv);
    if (!najbolji || ocena > najbolji.ocena) najbolji = { kandidat: k, ocena };
  }
  return najbolji;
}
