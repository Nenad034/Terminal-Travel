/**
 * M3 spec §2.11j/§2.11k — kad se jedna doplata primenjuje, i da li ulazi u zbir.
 *
 * Izdvojeno iz servisa jer su ovo dve odluke koje se ne vide na ekranu a menjaju iznos na
 * fakturi: (1) da li stavka uopšte važi za ovog gosta, u ovoj sobi, na ove datume; (2) da li
 * njen iznos ulazi u ukupnu cenu ili se samo prikazuje. Druga je vlasnikova odluka 9.9.2026:
 * ono što se plaća u hotelu **ne utiče na fakturisanje**, ali se gostu mora reći.
 */

export type Domet = 'CONTRACT' | 'SEASON' | 'PERIOD';

export interface DoplataZaProveru {
  seasonId: string | null;
  contractPeriodId: string | null;
  appliesToRoomTypes: string[];
  appliesFrom: Date | null;
  appliesTo: Date | null;
  ageFrom: number | null;
  ageTo: number | null;
  bookingFrom: Date | null;
  bookingTo: Date | null;
  payable: 'AGENCY' | 'ON_SITE';
  isMandatory: boolean;
}

export interface KontekstProdaje {
  seasonId: string | null;
  contractPeriodId: string | null;
  roomType: string;
  /** Datum boravka koji se proverava (jedna noć). */
  danBoravka: Date;
  /** Datum kad rezervacija NASTAJE — pri prodaji je to danas. */
  danRezervacije: Date;
  /** Uzrast gosta u godinama; `null` za stavke koje se ne vezuju za osobu. */
  uzrast: number | null;
}

/** Najuži popunjen nivo je domet stavke. */
export function domet(d: Pick<DoplataZaProveru, 'seasonId' | 'contractPeriodId'>): Domet {
  if (d.contractPeriodId) return 'PERIOD';
  if (d.seasonId) return 'SEASON';
  return 'CONTRACT';
}

function dan(v: Date): number {
  return Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate());
}

/**
 * Da li se stavka primenjuje u datom kontekstu.
 *
 * Prazno polje uvek znači „bez ograničenja", nikad „ne važi" — to je jedina interpretacija koja
 * ne menja ponašanje postojećih zapisa: doplata uneta pre v1.27 nema ni domet ni uzrast, i mora
 * nastaviti da važi tačno kao pre.
 */
export function vazi(d: DoplataZaProveru, k: KontekstProdaje): boolean {
  // Domet
  if (d.contractPeriodId && d.contractPeriodId !== k.contractPeriodId) return false;
  if (d.seasonId && d.seasonId !== k.seasonId) return false;

  // Tip sobe — prazan niz znači SVE (vlasnikov zahtev: „mogu biti različiti, a mogu i jednaki")
  if (d.appliesToRoomTypes.length > 0 && !d.appliesToRoomTypes.includes(k.roomType)) return false;

  // Datumski opseg same stavke (Novogodišnja večera)
  if (d.appliesFrom && dan(k.danBoravka) < dan(d.appliesFrom)) return false;
  if (d.appliesTo && dan(k.danBoravka) > dan(d.appliesTo)) return false;

  // Prozor rezervisanja — gleda datum NASTANKA rezervacije, ne boravka (§2.11e)
  if (d.bookingFrom && dan(k.danRezervacije) < dan(d.bookingFrom)) return false;
  if (d.bookingTo && dan(k.danRezervacije) > dan(d.bookingTo)) return false;

  // Uzrast. Stavka sa uzrasnim opsegom se ne primenjuje kad uzrast nije poznat — pogađanje bi
  // ovde značilo naplatiti dečju taksu odrasloj osobi ili obrnuto.
  if (d.ageFrom != null || d.ageTo != null) {
    if (k.uzrast == null) return false;
    if (d.ageFrom != null && k.uzrast < d.ageFrom) return false;
    if (d.ageTo != null && k.uzrast > d.ageTo) return false;
  }

  return true;
}

/**
 * Da li iznos ulazi u ukupnu cenu aranžmana.
 *
 * Vlasnikova odluka 9.9.2026: _„Ono što se plaća u hotelu ne utiče na fakturisanje, samo
 * obaveštavamo kupca šta treba da plati na licu mesta."_ Stavka sa `ON_SITE` se zato i dalje
 * unosi i **obavezno prikazuje** (ponuda, ugovor M20, vaučer M5 §6) — ali se ne sabira.
 */
export function ulaziUZbir(d: Pick<DoplataZaProveru, 'payable'>): boolean {
  return d.payable === 'AGENCY';
}

/**
 * Podela liste na ono što se naplaćuje i ono što se samo saopštava.
 * Postoji da nijedan pozivalac ne bi sam pisao `filter` po `payable` i nehotice izostavio prikaz.
 */
export function podeliPoNaplati<T extends { payable: 'AGENCY' | 'ON_SITE' }>(
  stavke: T[],
): { uZbiru: T[]; naLicuMesta: T[] } {
  return {
    uZbiru: stavke.filter((s) => ulaziUZbir(s)),
    naLicuMesta: stavke.filter((s) => !ulaziUZbir(s)),
  };
}
