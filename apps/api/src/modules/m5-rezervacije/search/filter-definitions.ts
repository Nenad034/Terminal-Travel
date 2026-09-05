import { DestinationType } from '@prisma/client';

// M5 spec §3.0c.3d (dopuna 5.9.2026, vlasnikov zahtev) — katalog filtera koje pretraga smeštaja
// zna da ponudi. Statična, poznata lista u kodu (isti princip kao AmenityTag, §2.3c: "filtrira se
// na klijentu nad fiksnim spiskom vrednosti koje backend već poznaje") — NE Prisma model, menja se
// samo kad developer doda nov filter, ne runtime podatak.
export interface FilterDefinition {
  /** Stabilan tehnički identifikator, npr. `DISTANCE_TO_SEA`. */
  key: string;
  /** `null`/prazno = filter je relevantan za SVAKI tip destinacije (npr. cena, zvezdice, wi-fi). */
  applicableDestinationTypes: DestinationType[] | null;
  /** `null`/prazno = filter je relevantan celu godinu. Brojevi 1–12. */
  activeMonths: number[] | null;
}

// Generički filteri (cena, zvezdice, ocena, amenity_tags[], vrsta usluge, odmah potvrda/upit,
// refundabilno) imaju OBA polja prazna — ponašaju se identično kao danas, ova dopuna ih ne menja.
// Namerno van obima ovog prolaza (M2 spec §2.1c/M5 §3.0c.3d): tačan, kompletan spisak budućih
// lokacijskih/sezonskih filtera — čeka konkretnu listu (docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md).
// Dole su samo dva primera potvrđena sa vlasnikom (M5 spec §3.0c.3d).
export const FILTER_DEFINITIONS: FilterDefinition[] = [
  { key: 'PRICE', applicableDestinationTypes: null, activeMonths: null },
  { key: 'STAR_RATING', applicableDestinationTypes: null, activeMonths: null },
  { key: 'GUEST_RATING', applicableDestinationTypes: null, activeMonths: null },
  { key: 'AMENITY_TAGS', applicableDestinationTypes: null, activeMonths: null },
  { key: 'BOARD_TYPE', applicableDestinationTypes: null, activeMonths: null },
  { key: 'AVAILABILITY_STATUS', applicableDestinationTypes: null, activeMonths: null },
  { key: 'REFUNDABLE', applicableDestinationTypes: null, activeMonths: null },
  // M5 spec §3.0c.3d — konkretan primer 1: udaljenost od mora, samo za primorske destinacije,
  // celogodišnje (nema sezonski uslov).
  { key: 'DISTANCE_TO_SEA', applicableDestinationTypes: ['COASTAL'], activeMonths: null },
  // M5 spec §3.0c.3d — konkretan primer 2 (Bad Klajnkirhajm): blizina ski lifta, samo za planinske
  // destinacije, I samo tokom zimskih meseci (novembar–mart). Van ovog perioda se NE prikazuje,
  // čak i za planinsku destinaciju — oba uslova moraju proći.
  { key: 'DISTANCE_TO_SKI_LIFT', applicableDestinationTypes: ['MOUNTAIN'], activeMonths: [11, 12, 1, 2, 3] },
];

/**
 * M5 spec §3.0c.3d — pravilo prikaza: filter se nudi samo ako (a) `applicableDestinationTypes` je
 * prazno ILI bar jedna destinacija iz rezultata pretrage ima taj tip, I (b) `activeMonths` je
 * prazno ILI je trenutni mesec pretrage na toj listi. Oba uslova moraju proći.
 */
export function isFilterApplicable(
  definition: FilterDefinition,
  presentDestinationTypes: (DestinationType | null)[],
  searchMonth: number,
): boolean {
  const destinationTypeOk =
    !definition.applicableDestinationTypes ||
    definition.applicableDestinationTypes.length === 0 ||
    presentDestinationTypes.some((t) => t !== null && definition.applicableDestinationTypes!.includes(t));

  const monthOk =
    !definition.activeMonths || definition.activeMonths.length === 0 || definition.activeMonths.includes(searchMonth);

  return destinationTypeOk && monthOk;
}

/** Filteri koji prolaze proveru za dati skup tipova destinacija i mesec pretrage. */
export function applicableFilters(
  presentDestinationTypes: (DestinationType | null)[],
  searchMonth: number,
): FilterDefinition[] {
  return FILTER_DEFINITIONS.filter((d) => isFilterApplicable(d, presentDestinationTypes, searchMonth));
}
