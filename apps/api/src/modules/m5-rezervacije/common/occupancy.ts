import { BadRequestException } from '@nestjs/common';
import {
  danUNedelji,
  imenaDana,
  vaziZaDan,
} from '../../m3-ugovaranje-alotmani/pricelist/weekday-coverage';
import { AgeCategory } from '@prisma/client';
import {
  resolveAgePricing,
  AgePricingCandidate,
} from '../../m3-ugovaranje-alotmani/contract-periods/age-pricing-resolution';

// M5 spec §3.2a — jedna stavka u occupancy.room_config[].
export interface RoomConfigEntry {
  roomTypeCode?: string | null;
  adults: number;
  children: number;
  childrenAges?: number[] | null;
}

export interface OccupancyInput {
  adults: number;
  children: number;
  roomConfig?: RoomConfigEntry[] | null;
}

// M2 spec §2.3b — age_policy[] stavka jedne room_types[] konfiguracije.
export interface AgePolicyEntry {
  category: AgeCategory;
  ageFrom: number;
  ageTo: number | null;
  countsTowardCapacity: boolean;
  maxCount: number | null;
  requiresCrib: boolean;
  cribIncluded: boolean | null;
}

export interface RoomTypeDefinition {
  code: string;
  capacityAdults: number;
  capacityChildren: number;
  agePolicy?: AgePolicyEntry[];
}

// M2 spec §2.3b — "podrazumevana politika (fallback)" kad room_types[] stavka nema
// eksplicitno postavljen age_policy[].
export const DEFAULT_AGE_POLICY: AgePolicyEntry[] = [
  {
    category: 'ADULT',
    ageFrom: 12,
    ageTo: null,
    countsTowardCapacity: true,
    maxCount: null,
    requiresCrib: false,
    cribIncluded: null,
  },
  {
    category: 'CHILD',
    ageFrom: 2,
    ageTo: 11.99,
    countsTowardCapacity: true,
    maxCount: null,
    requiresCrib: false,
    cribIncluded: null,
  },
  {
    category: 'INFANT',
    ageFrom: 0,
    ageTo: 1.99,
    countsTowardCapacity: false,
    maxCount: null,
    requiresCrib: true,
    cribIncluded: null,
  },
];

// M2 spec §2.3b — svrstavanje uzrasta u kategoriju po age_from/age_to (age_to = null znači "i više").
export function classifyAge(ageYears: number, agePolicy: AgePolicyEntry[]): AgePolicyEntry {
  const match = agePolicy.find(
    (p) => ageYears >= p.ageFrom && (p.ageTo === null || ageYears <= p.ageTo),
  );
  if (!match) {
    throw new BadRequestException(
      `Uzrast ${ageYears} ne odgovara nijednoj kategoriji age_policy ove sobe (M2 spec §2.3b) — dopunite politiku pre nastavka.`,
    );
  }
  return match;
}

export interface ClassifiedGuest {
  category: AgeCategory;
  occupantIndex: number; // redni broj unutar kategorije (M5 spec §3.2b, korak 1)
  requiresCrib: boolean;
}

// M5 spec §3.2b, korak 1 — svrstaj svakog gosta jedne sobe u kategoriju, dodeli occupant_index
// po redosledu unutar kategorije (odrasli su uvek ADULT; deca se svrstavaju preko children_ages[]).
export function classifyRoomGuests(
  room: RoomConfigEntry,
  agePolicy: AgePolicyEntry[],
): ClassifiedGuest[] {
  const guests: ClassifiedGuest[] = [];
  for (let i = 0; i < room.adults; i++) {
    guests.push({ category: 'ADULT', occupantIndex: i + 1, requiresCrib: false });
  }
  const perCategoryCounter = new Map<AgeCategory, number>();
  for (const age of room.childrenAges ?? []) {
    const policy = classifyAge(age, agePolicy);
    const next = (perCategoryCounter.get(policy.category) ?? 0) + 1;
    perCategoryCounter.set(policy.category, next);
    guests.push({
      category: policy.category,
      occupantIndex: next,
      requiresCrib: policy.requiresCrib,
    });
  }
  return guests;
}

// M5 spec §3.2a — "Pravilo slaganja: zbir adults/children preko svih stavki room_config[]
// mora odgovarati occupancy.adults/children na nivou cele stavke." Neusklađen zbir se odbija.
export function assertRoomConfigMatchesTotals(occupancy: OccupancyInput): RoomConfigEntry[] {
  const roomConfig: RoomConfigEntry[] =
    occupancy.roomConfig && occupancy.roomConfig.length > 0
      ? occupancy.roomConfig
      : [
          {
            roomTypeCode: null,
            adults: occupancy.adults,
            children: occupancy.children,
            childrenAges: null,
          },
        ];

  const sumAdults = roomConfig.reduce((s, r) => s + r.adults, 0);
  const sumChildren = roomConfig.reduce((s, r) => s + r.children, 0);
  if (sumAdults !== occupancy.adults || sumChildren !== occupancy.children) {
    throw new BadRequestException(
      `Zbir adults/children u room_config[] (${sumAdults}/${sumChildren}) ne odgovara occupancy.adults/children (${occupancy.adults}/${occupancy.children}) — M5 spec §3.2a.`,
    );
  }
  return roomConfig;
}

// M5 spec §3.2a — validacija kapaciteta po uzrastu. Samo kategorije sa counts_toward_capacity=true
// se broje protiv capacity_adults/capacity_children; max_count po kategoriji se sprovodi nezavisno.
export function assertRoomCapacity(room: RoomConfigEntry, roomType: RoomTypeDefinition): void {
  const agePolicy =
    roomType.agePolicy && roomType.agePolicy.length > 0 ? roomType.agePolicy : DEFAULT_AGE_POLICY;
  const guests = classifyRoomGuests(room, agePolicy);

  const perCategoryCount = new Map<AgeCategory, number>();
  for (const g of guests)
    perCategoryCount.set(g.category, (perCategoryCount.get(g.category) ?? 0) + 1);

  for (const policy of agePolicy) {
    const count = perCategoryCount.get(policy.category) ?? 0;
    if (policy.maxCount != null && count > policy.maxCount) {
      throw new BadRequestException(
        `Broj gostiju kategorije ${policy.category} (${count}) prelazi max_count (${policy.maxCount}) za sobu ${roomType.code} (M2 spec §2.3a).`,
      );
    }
  }

  const countingAdults = guests.filter(
    (g) =>
      g.category === 'ADULT' && agePolicy.find((p) => p.category === 'ADULT')?.countsTowardCapacity,
  ).length;
  const countingChildren = guests.filter((g) => {
    if (g.category === 'ADULT') return false;
    const policy = agePolicy.find((p) => p.category === g.category);
    return policy?.countsTowardCapacity ?? false;
  }).length;

  if (countingAdults > roomType.capacityAdults || countingChildren > roomType.capacityChildren) {
    throw new BadRequestException(
      `Traženi broj gostiju premašuje kapacitet sobe ${roomType.code} (M2 spec §2.3a/§2.3b).`,
    );
  }
}

// M5 spec §3.2b, korak 2 — pokušaj da se iz slobodnog teksta RateLine.occupancy izvede broj
// ADULT gostiju pokrivenih osnovnom cenom. `RateLine.occupancy` je NENAMERNO nestrukturiran
// string na M3 nivou (M3 spec §2.4) — ovo je dokumentovana interpretacija, ne tiha pretpostavka
// (vidi docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md §13, otvoreno pitanje):
// prepoznati srpski nazivi popunjenosti imaju prioritet; ako ništa ne odgovara, podrazumeva se
// da osnovna cena pokriva tačno onoliko odraslih koliko je traženo za tu sobu (nema dodatne
// naplate za odrasle kad se ne može pouzdano utvrditi osnovna popunjenost) — deca/tinejdžeri/bebe
// se i dalje uvek naplaćuju preko age_pricing[] (korak 4), bez obzira na ovu pretpostavku.
export function resolveBaseAdultsCovered(occupancyText: string, adultsInRoom: number): number {
  const normalized = occupancyText.toLowerCase();
  if (normalized.includes('jednokrevetn') || normalized.includes('single'))
    return Math.min(1, adultsInRoom);
  if (
    normalized.includes('dvokrevetn') ||
    normalized.includes('double') ||
    normalized.includes('twin')
  )
    return Math.min(2, adultsInRoom);
  if (normalized.includes('trokrevetn') || normalized.includes('triple'))
    return Math.min(3, adultsInRoom);
  if (
    normalized.includes('četvorokrevetn') ||
    normalized.includes('cetvorokrevetn') ||
    normalized.includes('quad')
  )
    return Math.min(4, adultsInRoom);
  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) return Math.min(parseInt(numericMatch[0], 10), adultsInRoom);
  return adultsInRoom;
}

export interface RateLineForCalc {
  price: number;
  // M3 §2.11c (v1.27) — četiri osnove, ne dve. `*_PER_STAY` znači da je cena za CEO boravak,
  // pa se NE množi brojem noćenja (Plava Laguna cenovnik: `Rate Base = STAY`).
  priceBasis:
    'PER_ROOM_PER_NIGHT' | 'PER_PERSON_PER_NIGHT' | 'PER_ROOM_PER_STAY' | 'PER_PERSON_PER_STAY';
  occupancy: string;
  cribFeePerNight: number | null;
}

/** Cena važi za ceo boravak, ne po noći (M3 §2.11c). */
export function jePoBoravku(basis: RateLineForCalc['priceBasis']): boolean {
  return basis === 'PER_ROOM_PER_STAY' || basis === 'PER_PERSON_PER_STAY';
}

/** Cena se odnosi na celu sobu, ne na osobu (M3 §2.4). */
export function jePoSobi(basis: RateLineForCalc['priceBasis']): boolean {
  return basis === 'PER_ROOM_PER_NIGHT' || basis === 'PER_ROOM_PER_STAY';
}

// M5 spec §3.2b — računanje base_cost jedne sobe za ceo boravak (korak 1-6), determinističko.
export function computeRoomBaseCost(params: {
  room: RoomConfigEntry;
  roomType: RoomTypeDefinition;
  rateLine: RateLineForCalc;
  agePricingCandidates: AgePricingCandidate[];
  nights: number;
  // M3 spec §2.3c (28.8.2026, na zahtev vlasnika: "uzrasna politika koja važi generalno za hotel
  // ne mora da bude ista kada taj hotel kreira cene za neku akciju" — npr. opšte "dete 2-12 =
  // 30% popust", ali za konkretan cenovnik "dete do 15 ima isti popust") — `ContractPeriod.
  // agePolicyOverride`, primenjuje se SAMO za klasifikaciju gosta radi CENE (ova funkcija), nikad
  // za fizički kapacitet sobe (`assertRoomCapacity` i dalje uvek koristi M2 sobinu politiku —
  // kapacitet je fizičko svojstvo sobe, ne menja se po cenovniku).
  agePolicyOverride?: AgePolicyEntry[] | null;
}): number {
  const { room, roomType, rateLine, agePricingCandidates, nights, agePolicyOverride } = params;
  if (nights <= 0) {
    throw new BadRequestException('Broj noćenja mora biti pozitivan (stay_to > stay_from).');
  }

  const agePolicy =
    agePolicyOverride && agePolicyOverride.length > 0
      ? agePolicyOverride
      : roomType.agePolicy && roomType.agePolicy.length > 0
        ? roomType.agePolicy
        : DEFAULT_AGE_POLICY;
  const guests = classifyRoomGuests(room, agePolicy);
  const adultsPresent = room.adults;

  // korak 2/3 — osnovna popunjenost i osnovna cena.
  const baseAdultsCovered = resolveBaseAdultsCovered(rateLine.occupancy, room.adults);
  const basePrice = jePoSobi(rateLine.priceBasis)
    ? rateLine.price
    : rateLine.price * baseAdultsCovered;

  // korak 4 — svaki gost iznad osnovne popunjenosti (dodatni ADULT, i svaki CHILD/TEEN/INFANT).
  // Doplata za gosta prati osnovu: procenat se računa od `rateLine.price`, pa kad je cena za
  // ceo boravak i doplata je za ceo boravak. Množenje noćenjima bi je udvostručilo.
  let extraPerNight = 0;
  let adultsCounted = 0;
  for (const guest of guests) {
    if (guest.category === 'ADULT') {
      adultsCounted++;
      if (adultsCounted <= baseAdultsCovered) continue; // pokriven osnovnom cenom, ne obračunava se posebno
    }
    const resolved = resolveAgePricing(
      agePricingCandidates,
      guest.category,
      guest.occupantIndex,
      adultsPresent,
    );
    if (!resolved) {
      throw new BadRequestException(
        `Nema odgovarajućeg age_pricing reda za gosta kategorije ${guest.category} (M3 spec §2.4a) — cena se ne pretpostavlja, kreiranje Ponude se odbija (M5 spec §3.2b).`,
      );
    }
    extraPerNight +=
      resolved.pricingMode === 'PERCENTAGE_OF_BASE_PRICE'
        ? Math.round(rateLine.price * (Number(resolved.percentage) / 100))
        : (resolved.flatPrice ?? 0);
  }

  // korak 5 — krevetac, jednom po traženom krevetcu.
  const cribGuests = guests.filter((g) => g.requiresCrib).length;
  const cribFeePerNight =
    rateLine.cribFeePerNight != null ? rateLine.cribFeePerNight * cribGuests : 0;

  // korak 6 — sabiranje. Krevetac je uvek po noći (i polje se tako zove), pa se množi noćenjima
  // bez obzira na osnovu; cena i doplata za gosta prate osnovu.
  const smestaj = jePoBoravku(rateLine.priceBasis)
    ? basePrice + extraPerNight
    : (basePrice + extraPerNight) * nights;
  return smestaj + cribFeePerNight * nights;
}

/**
 * M3 §2.11d — cena boravka kad kombinacija ima VIŠE cenovnih redova sa različitim danima.
 *
 * Vikend cena je po vlasnikovoj odluci drugi cenovni red (npr. „ned–čet 39,00" i „pet–sub
 * 52,00"), ne nova sezona. Boravak od subote do subote onda prelazi preko oba reda, pa cena
 * nije „jedan red × broj noći" nego **zbir po noćima**: svaka noć se naplaćuje po redu koji
 * pokriva njen dan u nedelji.
 *
 * Dve odluke koje se lako previde:
 *
 *  - **Noć se broji po danu PRIJAVE te noći.** Boravak 12.6–19.6. ima sedam noći: 12, 13, …, 18.
 *    Dan odjave nije noć.
 *  - **Cena „za ceo boravak" (`*_PER_STAY`) se naplaćuje JEDNOM**, po redu koji pokriva prvu noć.
 *    Da se naplaćuje po svakoj grupi dana, boravak preko vikenda bi platio ceo boravak dvaput.
 *    Krevetac i doplate za goste prate osnovu svog reda, isto kao u `computeRoomBaseCost`.
 */
export function computeRoomBaseCostPoNocima(params: {
  room: RoomConfigEntry;
  roomType: RoomTypeDefinition;
  /** ACTIVE redovi iste kombinacije (isti pansion i popunjenost), sa svojim danima. */
  lines: (RateLineForCalc & {
    id: string;
    validWeekdays?: number[] | null;
    agePricing: AgePricingCandidate[];
  })[];
  stayFrom: Date;
  stayTo: Date;
  agePolicyOverride?: AgePolicyEntry[] | null;
}): { baseCost: number; rateLineId: string } {
  const { room, roomType, lines, stayFrom, stayTo, agePolicyOverride } = params;
  const noci = Math.round((stayTo.getTime() - stayFrom.getTime()) / 86_400_000);
  if (noci <= 0) {
    throw new BadRequestException('Broj noćenja mora biti pozitivan (stay_to > stay_from).');
  }
  if (lines.length === 0) {
    throw new BadRequestException(
      'Nema nijedne cenovne stavke za tražene datume (M3 spec §2.11d).',
    );
  }

  // Koliko noći pripada kom redu — redosled se čuva, da se prvi red (onaj koji pokriva prvu noć)
  // može prijaviti kao `rate_line_id` stavke.
  const poRedu = new Map<string, number>();
  const redosled: string[] = [];
  const nepokriveni: number[] = [];

  for (let i = 0; i < noci; i++) {
    const noc = new Date(stayFrom.getTime() + i * 86_400_000);
    const red = lines.find((l) => vaziZaDan({ validWeekdays: l.validWeekdays }, noc));
    if (!red) {
      nepokriveni.push(danUNedelji(noc));
      continue;
    }
    if (!poRedu.has(red.id)) redosled.push(red.id);
    poRedu.set(red.id, (poRedu.get(red.id) ?? 0) + 1);
  }

  if (nepokriveni.length > 0) {
    throw new BadRequestException(
      `Za ${imenaDana([...new Set(nepokriveni)].sort())} ovaj cenovnik nema cenu — ` +
        `boravak se ne može ponuditi (M3 spec §2.11d).`,
    );
  }

  let ukupno = 0;
  let prviPoBoravku = true;
  for (const id of redosled) {
    const red = lines.find((l) => l.id === id)!;
    if (jePoBoravku(red.priceBasis) && !prviPoBoravku) continue; // ceo boravak se plaća jednom
    if (jePoBoravku(red.priceBasis)) prviPoBoravku = false;
    ukupno += computeRoomBaseCost({
      room,
      roomType,
      rateLine: red,
      agePricingCandidates: red.agePricing,
      nights: poRedu.get(id)!,
      agePolicyOverride,
    });
  }

  return { baseCost: ukupno, rateLineId: redosled[0] };
}
