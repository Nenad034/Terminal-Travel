/**
 * M2 spec §2.3g — raspored osoba po krevetima.
 *
 * Vlasnikovo tvrdo ograničenje (10.9.2026) oblikuje ceo ovaj fajl: kategorije osoba
 * (`ADL`/`CHD`/`INF` naspram `ADL`/`CHD1`/`CHD2`/`INF`) su svojstvo CENOVNIKA i menjaju se od
 * ugovora do ugovora, a raspored po krevetima je FIZIČKO svojstvo sobe i ne menja se. Zato se
 * ovde nikad ne pojavljuje nijedna kategorija iz cenovnika — samo uloga na krevetu. Isti gost se
 * dva puta nezavisno razrešava iz istog podatka (svojih godina): soba kaže gde sme da spava,
 * cenovnik kaže koliko košta.
 *
 * Tako je PrimeTravel pogrešio (`pricingRulesGenerator.ts` ima `CHD1`/`CHD2`/`CHD3` zakucane u
 * tip): njihova matrica važi za jedan cenovnik i pravi se iznova za svaki sledeći.
 *
 * **Matrica se izračunava, ne kuca** — u `bed_combinations[]` se čuvaju SAMO odstupanja. Pun
 * spisak bi tiho zastareo čim se promeni broj kreveta.
 */

export type VrstaKreveta = 'OSNOVNI' | 'POMOCNI';
export type UlogaNaKrevetu = 'ODRASLA' | 'DETE';

export interface MestoUSobi {
  krevet: VrstaKreveta;
  ko: UlogaNaKrevetu;
}

/** Jedan red izvedene matrice — šta soba fizički prima. */
export interface IzvedenaKombinacija {
  key: string;
  odraslih: number;
  dece: number;
  ukupno: number;
  /** Ko na kom krevetu leži, redom. Odrasli pune osnovne krevete pre pomoćnih. */
  raspored: MestoUSobi[];
  /**
   * Koliko dece iz ove kombinacije završava na POMOĆNOM krevetu. Ne ograničava ništa ovde —
   * služi ekranu da uz red pokaže `extra_bed_max_age` granicu (§2.3b). Matrica govori KOLIKO
   * dece sme, uzrasna granica govori KOJE (§2.3g, „Šta se ovde NE čuva").
   */
  decaNaPomocnom: number;
}

/** Odstupanje koje se stvarno čuva u `attributes.room_types[].bed_combinations[]` (§2.3g). */
export interface BedCombinationOverride {
  key: string;
  allowed?: boolean;
  shared_bed_children?: number;
  note?: string | null;
}

export interface BedsLike {
  base_beds?: number | null;
  extra_beds_max?: number | null;
}

/** Izvedeni red spojen sa odstupanjem koje na njega pada — ono što ekran i M5 stvarno čitaju. */
export interface RedMatrice extends IzvedenaKombinacija {
  allowed: boolean;
  shared_bed_children: number;
  note: string | null;
  /** `true` kad na ovaj red pada zapis iz `bed_combinations[]` (dakle odstupanje od izvedenog). */
  imaOdstupanje: boolean;
}

export function kljucKombinacije(odraslih: number, dece: number): string {
  return `${odraslih}A_${dece}C`;
}

function celBrojNeNegativan(v: number | null | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v));
}

/**
 * Izvodi svaki raspored koji soba fizički prima (§2.3g).
 *
 * Ukupan broj osoba ide od `min_occupancy` (ili 1 kad nije postavljen) do
 * `base_beds + extra_beds_max`, a za svaki ukupan broj se nabroje sve podele na odrasle i decu.
 *
 * **Bar jedna odrasla osoba u svakom redu.** To nije proizvoljno: izlazni kriterijum §8 koji je
 * vlasnik potvrdio nabraja za sobu 2+1 tačno `3A_0C`, `2A_1C`, `1A_2C` — `0A_3C` nema, iako
 * „sve podele" doslovno čitano uključuje i njega. Soba puna samo dece nije prodajni slučaj.
 *
 * Redosled je isti kao u tom kriterijumu: po ukupnom broju osoba rastuće, pa po broju odraslih
 * opadajuće.
 */
export function izvediMatricu(
  beds: BedsLike | null | undefined,
  minOccupancy?: number | null,
): IzvedenaKombinacija[] {
  const osnovnih = celBrojNeNegativan(beds?.base_beds);
  const pomocnih = celBrojNeNegativan(beds?.extra_beds_max);
  const maxUkupno = osnovnih + pomocnih;
  // Soba bez ijednog kreveta ne daje nijedan red. Prazna matrica ovde znači „nema unetih
  // kreveta", ne „ništa nije dozvoljeno" — ekran to mora reći rečenicom, ne praznom tabelom.
  if (maxUkupno === 0) return [];

  const minUkupno = Math.min(Math.max(1, celBrojNeNegativan(minOccupancy) || 1), maxUkupno);

  const redovi: IzvedenaKombinacija[] = [];
  for (let ukupno = minUkupno; ukupno <= maxUkupno; ukupno++) {
    for (let odraslih = ukupno; odraslih >= 1; odraslih--) {
      const dece = ukupno - odraslih;
      redovi.push({
        key: kljucKombinacije(odraslih, dece),
        odraslih,
        dece,
        ukupno,
        raspored: rasporedi(odraslih, dece, osnovnih, pomocnih),
        decaNaPomocnom: Math.max(0, dece - Math.max(0, osnovnih - odraslih)),
      });
    }
  }
  return redovi;
}

/**
 * Determinističko raspoređivanje (§2.3g): odrasli redom pune osnovne krevete, pa pomoćne; deca
 * zauzimaju ono što preostane.
 */
function rasporedi(
  odraslih: number,
  dece: number,
  osnovnih: number,
  pomocnih: number,
): MestoUSobi[] {
  const kreveti: VrstaKreveta[] = [
    ...Array<VrstaKreveta>(osnovnih).fill('OSNOVNI'),
    ...Array<VrstaKreveta>(pomocnih).fill('POMOCNI'),
  ];
  return kreveti
    .slice(0, odraslih + dece)
    .map((krevet, i) => ({ krevet, ko: i < odraslih ? 'ODRASLA' : ('DETE' as UlogaNaKrevetu) }));
}

/**
 * Ključevi iz `bed_combinations[]` koji se iz zatečenih kreveta više ne izvode (§2.3g).
 *
 * Nastaju kad neko smanji `base_beds`/`extra_beds_max` posle unosa pravila. Takav zapis se
 * **prijavljuje i ignoriše u obračunu, ne briše tiho** — isti princip kao ograda u M3 §2.4a:
 * sporan slučaj ide čoveku. Tiho brisanje bi uklonilo pravilo koje je neko svesno uneo, a koje
 * ponovo postaje tačno čim se kreveti vrate.
 */
export function odstupanjaVanMatrice(
  matrica: IzvedenaKombinacija[],
  odstupanja: BedCombinationOverride[] | null | undefined,
): BedCombinationOverride[] {
  if (!odstupanja || odstupanja.length === 0) return [];
  const postojeci = new Set(matrica.map((r) => r.key));
  return odstupanja.filter((o) => !postojeci.has(o.key));
}

/**
 * Spaja izvedenu matricu sa odstupanjima.
 *
 * **Prazan `bed_combinations[]` znači „sve fizički moguće kombinacije su dozvoljene", nikad
 * „nijedna"** (§2.3g) — ista konvencija kao svuda u ovoj kodbazi: prazan niz = bez ograničenja.
 * Hotel bez posebnih pravila nema nijedan zapis.
 */
export function primeniOdstupanja(
  matrica: IzvedenaKombinacija[],
  odstupanja: BedCombinationOverride[] | null | undefined,
): RedMatrice[] {
  const poKljucu = new Map((odstupanja ?? []).map((o) => [o.key, o]));
  return matrica.map((red) => {
    const o = poKljucu.get(red.key);
    return {
      ...red,
      allowed: o?.allowed ?? true,
      shared_bed_children: celBrojNeNegativan(o?.shared_bed_children),
      note: o?.note ?? null,
      imaOdstupanje: o !== undefined,
    };
  });
}
