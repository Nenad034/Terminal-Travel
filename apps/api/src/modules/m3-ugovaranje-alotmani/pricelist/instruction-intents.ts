/**
 * M3 spec §4.8 — izmena cenovnika rečima, deterministički deo.
 *
 * Podela posla je ista kao kod uvoza dokumenta (§4.2.6, M15 princip „kod radi najviše posla"):
 *
 *  - **model** prevodi rečenicu u **nameru** — na šta se izmena odnosi i kakva je (procenat,
 *    iznos, nova vrednost, gašenje);
 *  - **kod** razrešava na koje tačno stavke se namera odnosi i **računa nove vrednosti**.
 *
 * Spec to izričito traži: _„procenat se primenjuje kodom, ne modelom"_. Razlog je merljiv: jezički
 * model ume da pogreši u aritmetici i da tu grešku napiše samouvereno, a rezultat je pogrešna
 * nabavna cena — greška koja ne pravi buku nego tiho menja maržu na svakoj rezervaciji.
 *
 * Ovde nema ni baze, ni HTTP-a, ni modela. Ulaz je zatečeno stanje cenovnika i spisak namera,
 * izlaz je predlog novog stanja.
 */

/** Na šta se namera odnosi. Prazan niz uvek znači **bez ograničenja**, nikad „ni na šta". */
export interface DometNamere {
  seasonCodes?: string[] | null;
  roomTypes?: string[] | null;
  boardTypes?: string[] | null;
  occupancies?: string[] | null;
}

export type VrstaNamere =
  | 'CENA_PROCENAT'
  | 'CENA_IZNOS'
  | 'CENA_NOVA_VREDNOST'
  | 'CENA_GASENJE'
  | 'DOPLATA_NOVA'
  | 'DOPLATA_GASENJE'
  | 'NEPODRZANO';

export interface Namera extends DometNamere {
  vrsta: VrstaNamere;
  /** Deo rečenice iz kog je namera nastala — ide na ekran uz predlog. */
  obrazlozenje: string;
  /** `CENA_PROCENAT`: +5 poskupljuje za 5 %, −10 pojeftinjuje za 10 %. */
  procenat?: number | null;
  /** `CENA_IZNOS` i `CENA_NOVA_VREDNOST`: najmanja jedinica valute. */
  iznosMinor?: number | null;
  /** `DOPLATA_NOVA` / `DOPLATA_GASENJE`: naziv doplate. */
  nazivDoplate?: string | null;
  doplata?: PredlozenaDoplata | null;
  /** `NEPODRZANO`: šta je model prepoznao a ovaj tok ne ume da primeni. */
  nepodrzanoObjasnjenje?: string | null;
}

export interface PredlozenaDoplata {
  name: string;
  kind: 'SURCHARGE' | 'DISCOUNT';
  pricingMode: 'FLAT_PER_UNIT' | 'PERCENTAGE_OF_NIGHTLY_RATE';
  flatAmount?: number | null;
  percentageOfNightlyRate?: number | null;
  priceBasis: string;
  payable: 'AGENCY' | 'ON_SITE';
  isMandatory: boolean;
  seasonCode?: string | null;
  appliesToRoomTypes?: string[] | null;
}

/** Jedna cenovna stavka zatečenog cenovnika, u obliku u kom je namera može pogoditi. */
export interface StavkaCenovnika {
  roomType: string;
  seasonCode: string;
  boardType: string;
  occupancy: string;
  priceBasis: string;
  validWeekdays: number[];
  price: number;
  bookingFrom?: string | null;
  bookingTo?: string | null;
}

export interface RezultatPrimene {
  /** Cenovnik kakav bi bio da se sve namere prihvate. Ulaz za poređenje verzija (§2.11l). */
  redovi: StavkaCenovnika[];
  /** Doplate koje treba dodati, po jedna po nameri. */
  noveDoplate: PredlozenaDoplata[];
  /** Nazivi doplata koje treba ugasiti. */
  ugaseneDoplate: string[];
  /** Namere koje ovaj tok ne ume da primeni — prijavljuju se, ne ćute se. */
  neprimenjeno: { obrazlozenje: string; razlog: string }[];
}

function pogadja(s: StavkaCenovnika, n: DometNamere): boolean {
  const uSkupu = (v: string, skup?: string[] | null) =>
    !skup ||
    skup.length === 0 ||
    skup.some((x) => x.trim().toLowerCase() === v.trim().toLowerCase());
  return (
    uSkupu(s.seasonCode, n.seasonCodes) &&
    uSkupu(s.roomType, n.roomTypes) &&
    uSkupu(s.boardType, n.boardTypes) &&
    uSkupu(s.occupancy, n.occupancies)
  );
}

/**
 * Nova cena za jednu stavku. Zaokruživanje ide na **najbliži ceo broj najmanje jedinice** —
 * 62,00 uvećano za 5 % je 65,10, ne 65,0999…; polovina se zaokružuje naviše, isto pravilo koje
 * već koristi obračun marže.
 */
export function novaCena(stara: number, n: Namera): number | null {
  switch (n.vrsta) {
    case 'CENA_PROCENAT': {
      if (n.procenat == null || !Number.isFinite(n.procenat)) return null;
      return Math.round(stara * (1 + n.procenat / 100));
    }
    case 'CENA_IZNOS': {
      if (n.iznosMinor == null || !Number.isInteger(n.iznosMinor)) return null;
      return stara + n.iznosMinor;
    }
    case 'CENA_NOVA_VREDNOST': {
      if (n.iznosMinor == null || !Number.isInteger(n.iznosMinor)) return null;
      return n.iznosMinor;
    }
    default:
      return null;
  }
}

/**
 * Primena namera na zatečeni cenovnik.
 *
 * Namere se primenjuju **redom kojim su navedene** — rečenica „sve gore 5 %, a studio na 90 €"
 * mora dati studio na 90 €, ne 94,50. Redosled u rečenici je redosled odluke.
 *
 * Cena koja bi ispala nula ili negativna se **ne primenjuje** nego prijavljuje: popust od 120 %
 * je skoro sigurno pogrešno pročitana rečenica, a cena 0 bi tiho postala besplatan smeštaj.
 */
export function primeniNamere(zatecene: StavkaCenovnika[], namere: Namera[]): RezultatPrimene {
  const redovi = zatecene.map((s) => ({ ...s }));
  const ugasene = new Set<number>();
  const noveDoplate: PredlozenaDoplata[] = [];
  const ugaseneDoplate: string[] = [];
  const neprimenjeno: RezultatPrimene['neprimenjeno'] = [];

  for (const n of namere) {
    if (n.vrsta === 'NEPODRZANO') {
      neprimenjeno.push({
        obrazlozenje: n.obrazlozenje,
        razlog:
          n.nepodrzanoObjasnjenje ??
          'Ova vrsta izmene se ne menja rečima u ovom prolazu — uradite je na svom ekranu.',
      });
      continue;
    }

    if (n.vrsta === 'DOPLATA_NOVA') {
      if (!n.doplata) {
        neprimenjeno.push({
          obrazlozenje: n.obrazlozenje,
          razlog: 'Iz rečenice se ne vidi dovoljno o doplati (iznos, osnova, gde se plaća).',
        });
        continue;
      }
      noveDoplate.push(n.doplata);
      continue;
    }

    if (n.vrsta === 'DOPLATA_GASENJE') {
      if (!n.nazivDoplate?.trim()) {
        neprimenjeno.push({
          obrazlozenje: n.obrazlozenje,
          razlog: 'Nije jasno koja doplata se ukida.',
        });
        continue;
      }
      ugaseneDoplate.push(n.nazivDoplate.trim());
      continue;
    }

    const pogodjene = redovi
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => !ugasene.has(i) && pogadja(s, n));

    if (pogodjene.length === 0) {
      neprimenjeno.push({
        obrazlozenje: n.obrazlozenje,
        razlog:
          'Nijedna stavka cenovnika ne odgovara ovom opisu — proverite oznaku sezone ili sobe.',
      });
      continue;
    }

    if (n.vrsta === 'CENA_GASENJE') {
      for (const { i } of pogodjene) ugasene.add(i);
      continue;
    }

    let neispravnih = 0;
    for (const { s, i } of pogodjene) {
      const nova = novaCena(s.price, n);
      if (nova == null || nova <= 0) {
        neispravnih++;
        continue;
      }
      redovi[i] = { ...s, price: nova };
    }
    if (neispravnih === pogodjene.length) {
      neprimenjeno.push({
        obrazlozenje: n.obrazlozenje,
        razlog: 'Izračunata cena ne bi bila pozitivan iznos — izmena se ne primenjuje.',
      });
    } else if (neispravnih > 0) {
      neprimenjeno.push({
        obrazlozenje: n.obrazlozenje,
        razlog: `${neispravnih} stavki bi dobilo cenu nula ili manju, pa su preskočene.`,
      });
    }
  }

  return {
    redovi: redovi.filter((_, i) => !ugasene.has(i)),
    noveDoplate,
    ugaseneDoplate,
    neprimenjeno,
  };
}
