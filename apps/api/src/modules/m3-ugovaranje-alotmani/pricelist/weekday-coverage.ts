/**
 * M3 spec §2.11d — dani u nedelji na cenovnom redu.
 *
 * Vlasnikova odluka 9.9.2026: dani se biraju kao **tagovi**, ne kao fiksna podela „radni dani /
 * vikend" — jer „vikend" nije isti u svakom hotelu (kod njih je to petak i subota; nedelja se ne
 * računa jer gost te noći više ne spava). Vikend cena je zato **drugi cenovni red sa drugim
 * danima**, ne nova sezona.
 *
 * Ovde stoje dve odvojene provere, i razlika među njima je namerna:
 *
 *  - **Preklapanje** (`nadjiPreklapanje`) je greška koja se **odbija pri upisu**: dva reda iste
 *    kombinacije koja pokrivaju isti dan daju dve cene za isti datum, a sistem tada nema način
 *    da izabere — bilo koji izbor je pogađanje nad novcem.
 *  - **Nepokriven dan** (`nepokriveniDani`) je **upozorenje, ne odbijanje**. Cenovnik se unosi
 *    red po red: prvi red „ned–čet" bi po strogom pravilu bio odbijen jer petak i subota još
 *    nisu uneti, pa se drugi red nikad ne bi ni stigao dodati. Zato se nepokrivenost prijavljuje
 *    posle svakog upisa i vidi se na ekranu, a stvarna posledica (nema cene za taj datum) i
 *    dalje postoji u prodaji — samo se ne pravi tako da unos bude nemoguć.
 */

/** 1 = ponedeljak … 7 = nedelja (ISO 8601, isto kao `Date.getUTCDay()` uz nedelju kao 7). */
export const SVI_DANI = [1, 2, 3, 4, 5, 6, 7];

export const IMENA_DANA: Record<number, string> = {
  1: 'ponedeljak',
  2: 'utorak',
  3: 'sreda',
  4: 'četvrtak',
  5: 'petak',
  6: 'subota',
  7: 'nedelja',
};

export interface RedZaProveru {
  id?: string;
  boardType: string;
  occupancy: string;
  /**
   * Prazan niz = svi dani (§2.11d). `undefined`/`null` se tretira isto kao prazno — zapis
   * pročitan pre ove verzije, ili `select` koji polje ne uzima, ne sme da obori obračun cene.
   */
  validWeekdays?: number[] | null;
}

/** Dan u nedelji po ISO pravilu: ponedeljak = 1, nedelja = 7. */
export function danUNedelji(d: Date): number {
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

/** Prazan niz znači „svi dani" — jedina interpretacija koja ne menja zatečene zapise. */
export function daniReda(r: Pick<RedZaProveru, 'validWeekdays'>): number[] {
  const d = r.validWeekdays ?? [];
  return d.length === 0 ? SVI_DANI : [...new Set(d)].sort();
}

/** Da li cena važi za tu noć. */
export function vaziZaDan(r: Pick<RedZaProveru, 'validWeekdays'>, dan: Date): boolean {
  return daniReda(r).includes(danUNedelji(dan));
}

/** Redovi jedne kombinacije = isti pansion i ista popunjenost (tip sobe nosi sam period). */
function istaKombinacija(a: RedZaProveru, b: RedZaProveru): boolean {
  return a.boardType === b.boardType && a.occupancy === b.occupancy;
}

/**
 * Dani koje bi nov/izmenjen red pokrio dvaput unutar svoje kombinacije.
 *
 * `postojeci` su ACTIVE redovi istog perioda; red sa istim `id` se izuzima, jer izmena reda nije
 * sudar sa samim sobom.
 */
export function nadjiPreklapanje(nov: RedZaProveru, postojeci: RedZaProveru[]): number[] {
  const daniNovog = new Set(daniReda(nov));
  const sudari = new Set<number>();
  for (const p of postojeci) {
    if (p.id && nov.id && p.id === nov.id) continue;
    if (!istaKombinacija(nov, p)) continue;
    for (const d of daniReda(p)) if (daniNovog.has(d)) sudari.add(d);
  }
  return [...sudari].sort();
}

/** Dani koje nijedan red te kombinacije ne pokriva — za njih pretraga nema cenu. */
export function nepokriveniDani(redovi: RedZaProveru[]): number[] {
  if (redovi.length === 0) return [];
  const pokriveni = new Set(redovi.flatMap((r) => daniReda(r)));
  return SVI_DANI.filter((d) => !pokriveni.has(d));
}

/** Čitljiv spisak dana za poruku korisniku („petak i subota", ne „[5,6]"). */
export function imenaDana(dani: number[]): string {
  const imena = dani.map((d) => IMENA_DANA[d] ?? String(d));
  if (imena.length <= 1) return imena.join('');
  return `${imena.slice(0, -1).join(', ')} i ${imena[imena.length - 1]}`;
}

/**
 * §2.11d — turnusi. Da li boravak poštuje dane prijave/odjave i dozvoljene dužine.
 *
 * Prazan niz uvek znači „bez ograničenja". Vraća razlog na srpskom ili `null` kad je sve u redu —
 * razlog se prosleđuje gostu/agentu, pa mora reći ŠTA nije u redu, ne samo da nije.
 */
export function proveriTurnus(
  period: {
    arrivalWeekdays?: number[] | null;
    departureWeekdays?: number[] | null;
    allowedStayNights?: number[] | null;
  },
  boravak: { od: Date; do: Date },
): string | null {
  const dolasci = period.arrivalWeekdays ?? [];
  const odlasci = period.departureWeekdays ?? [];
  const duzine = period.allowedStayNights ?? [];
  const noci = Math.round((boravak.do.getTime() - boravak.od.getTime()) / 86_400_000);

  if (dolasci.length > 0 && !dolasci.includes(danUNedelji(boravak.od)))
    return `Prijava je moguća samo: ${imenaDana(dolasci)} (M3 spec §2.11d).`;

  if (odlasci.length > 0 && !odlasci.includes(danUNedelji(boravak.do)))
    return `Odjava je moguća samo: ${imenaDana(odlasci)} (M3 spec §2.11d).`;

  if (duzine.length > 0 && !duzine.includes(noci))
    return `Dozvoljena dužina boravka je ${duzine.join(' / ')} noći, traženo je ${noci} (M3 spec §2.11d).`;

  return null;
}
