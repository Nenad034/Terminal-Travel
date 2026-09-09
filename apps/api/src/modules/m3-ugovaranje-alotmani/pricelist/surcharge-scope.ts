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
  if (!vaziPoDometu(d, k)) return false;
  if (!vaziPoUzrastu(d, k.uzrast)) return false;
  return true;
}

/**
 * Sve osim uzrasta: domet, tip sobe, datum boravka, prozor rezervisanja.
 *
 * Izdvojeno zato što se uzrast zna na dva različita mesta u različitoj meri. Pri obračunu cene
 * za jednog gosta uzrast je poznat i mora da odluči (`vazi` iznad). Pri **prikazu spiska
 * doplata na stavci rezervacije** uzrast nije poznat — `BookingItem` nosi samo ime i prezime
 * putnika (M5 `CreateBookingItemGuestDto` namerno nema `guestProfileId`) — pa bi provera po
 * uzrastu sakrila boravišnu taksu koju prodavac mora da vidi. Tamo se koristi ovaj deo, a
 * uzrasni opseg se prikazuje uz stavku da čovek izabere stepen.
 */
export function vaziPoDometu(d: DoplataZaProveru, k: KontekstProdaje): boolean {
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

  return true;
}

/**
 * Uzrast. Stavka sa uzrasnim opsegom se ne primenjuje kad uzrast nije poznat — pogađanje bi
 * ovde značilo naplatiti dečju taksu odrasloj osobi ili obrnuto.
 */
export function vaziPoUzrastu(
  d: Pick<DoplataZaProveru, 'ageFrom' | 'ageTo'>,
  uzrast: number | null,
): boolean {
  if (d.ageFrom == null && d.ageTo == null) return true;
  if (uzrast == null) return false;
  if (d.ageFrom != null && uzrast < d.ageFrom) return false;
  if (d.ageTo != null && uzrast > d.ageTo) return false;
  return true;
}

/** Da li stavka uopšte nosi uzrasni uslov (boravišna taksa u stepenima ga nosi, večera ne). */
export function imaUzrasniOpseg(d: Pick<DoplataZaProveru, 'ageFrom' | 'ageTo'>): boolean {
  return d.ageFrom != null || d.ageTo != null;
}

/**
 * Ista provera kao `vaziPoDometu`, ali nad CELIM boravkom jedne stavke rezervacije umesto nad
 * jednom noći: stavka važi ako se njen datumski opseg seče sa boravkom bar jednom noći.
 *
 * Bez ovoga bi Novogodišnja večera (31.12) ispala iz spiska za boravak 28.12–03.01, jer se
 * spisak pravi jednom za celu stavku, a ne po noći. `boravakDo` je dan odjave — poslednja noć
 * je dan pre njega.
 */
export function vaziZaBoravak(
  d: DoplataZaProveru,
  k: Omit<KontekstProdaje, 'danBoravka' | 'uzrast'> & { boravakOd: Date; boravakDo: Date },
): boolean {
  const poslednjaNoc = new Date(dan(k.boravakDo) - 86_400_000);
  const prvaNoc = k.boravakOd;
  // Presek dva opsega: stavka počinje pre kraja boravka i završava se posle početka boravka.
  if (d.appliesFrom && dan(d.appliesFrom) > dan(poslednjaNoc < prvaNoc ? prvaNoc : poslednjaNoc))
    return false;
  if (d.appliesTo && dan(d.appliesTo) < dan(prvaNoc)) return false;

  return vaziPoDometu(
    { ...d, appliesFrom: null, appliesTo: null },
    { ...k, danBoravka: prvaNoc, uzrast: null },
  );
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
