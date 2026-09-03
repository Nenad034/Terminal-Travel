// M5 spec §6.7a / M3 spec §2.6 (v1.13) — obračun doplate i popusta.
//
// Čist modul, bez Prisma runtime-a (isti obrazac kao `markup-formula.ts`/`refundability.ts`) —
// pravilo obračuna se testira samo, bez baze.
//
// Dve stvari koje se lako promaše, pa stoje ovde a ne u servisu:
//
// 1. **Iznos je uvek pozitivan, znak nosi `kind`.** M3 v1.13 to izričito traži: popust upisan
//    kao negativan iznos uz `kind = DISCOUNT` bio bi dvostruka negacija i prva greška u zbiru.
//    Zato `computeAncillaryAmount` vraća pozitivnu vrednost, a `signedAncillaryAmount` je jedina
//    funkcija koja sme da stavi minus.
// 2. **Osnova je PAR** (osoba/soba × dan/period). Množilac se zato računa iz obe polovine
//    naziva, ne iz jedne — `PER_ROOM_PER_STAY` je jednom po sobi, `PER_PERSON_PER_NIGHT` je za
//    svaku osobu i svaku noć.

export type AncillaryPriceBasisLike =
  | 'PER_PERSON_PER_NIGHT'
  | 'PER_ROOM_PER_NIGHT'
  | 'PER_PERSON_PER_STAY'
  | 'PER_ROOM_PER_STAY'
  | 'PER_PET_PER_NIGHT'
  | 'PER_PET_PER_STAY';

export interface AncillaryServiceLike {
  kind: 'SURCHARGE' | 'DISCOUNT';
  pricingMode: 'FLAT_PER_UNIT' | 'PERCENTAGE_OF_NIGHTLY_RATE';
  flatAmount: number | null;
  percentageOfNightlyRate: number | string | { toString(): string } | null;
  priceBasis: AncillaryPriceBasisLike;
  coversPersons: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  childMaxAge: number | string | { toString(): string } | null;
  maxQuantity: number | null;
}

export interface AncillaryContext {
  /** Broj noći matične stavke; za dnevnu osnovu množilac, inače se ne koristi. */
  nights: number;
  adults: number;
  children: number;
  /** Broj soba/jedinica matične stavke (`BookingItem.unit_count`). */
  rooms: number;
  /** Nabavna cena JEDNE noći matične stavke — osnova za `PERCENTAGE_OF_NIGHTLY_RATE`. */
  nightlyRate: number;
  /** Koliko komada usluge (ljubimci, dodatni ležajevi…). Podrazumevano 1. */
  quantity?: number;
}

/** Koliko puta se jedinična cena množi, po osnovi. */
export function basisMultiplier(basis: AncillaryPriceBasisLike, ctx: AncillaryContext): number {
  const persons = Math.max(ctx.adults + ctx.children, 0);
  const nights = Math.max(ctx.nights, 1);
  const rooms = Math.max(ctx.rooms, 1);
  switch (basis) {
    case 'PER_PERSON_PER_NIGHT':
      return persons * nights;
    case 'PER_PERSON_PER_STAY':
      return persons;
    case 'PER_ROOM_PER_NIGHT':
      return rooms * nights;
    case 'PER_ROOM_PER_STAY':
      return rooms;
    case 'PER_PET_PER_NIGHT':
      return nights;
    case 'PER_PET_PER_STAY':
      return 1;
  }
}

/**
 * Nabavni iznos doplate/popusta, UVEK pozitivan, u najmanjoj jedinici valute (ista konvencija
 * kao svuda u M5/M3). Zaokružuje se jednom, na kraju — zaokruživanje jedinične cene pa množenje
 * daje drugačiji rezultat kod procentualnih doplata na dugom boravku.
 */
export function computeAncillaryAmount(svc: AncillaryServiceLike, ctx: AncillaryContext): number {
  const unit =
    svc.pricingMode === 'FLAT_PER_UNIT'
      ? (svc.flatAmount ?? 0)
      : ctx.nightlyRate * (svc.percentageOfNightlyRate != null ? Number(svc.percentageOfNightlyRate) : 0) / 100;
  const quantity = Math.max(ctx.quantity ?? 1, 1);
  return Math.round(unit * basisMultiplier(svc.priceBasis, ctx) * quantity);
}

/** Doprinos ukupnoj ceni: popust ulazi sa minusom, doplata sa plusom. */
export function signedAncillaryAmount(svc: AncillaryServiceLike, ctx: AncillaryContext): number {
  const amount = computeAncillaryAmount(svc, ctx);
  return svc.kind === 'DISCOUNT' ? -amount : amount;
}

export interface OccupancyCheckInput {
  adults: number;
  children: number;
  /** Uzrasti dece, kad su poznati — bez njih se `child_max_age` ne može proveriti. */
  childrenAges?: number[];
}

/**
 * M3 v1.13 / M5 §6.7a — provera da traženi sastav gostiju staje u granice stavke. Primenjuje se
 * ISKLJUČIVO na `PER_ROOM_*` osnovu: kod cene po osobi svaka osoba već plaća svoje, pa granica
 * „za koliko osoba važi" nema smisla.
 *
 * Vraća razlog na srpskom umesto gole zastavice — poruka ide pravo agentu na ekran, a „ne može"
 * bez razloga je najbrži put do poziva podršci.
 */
export function checkAncillaryOccupancy(svc: AncillaryServiceLike, guests: OccupancyCheckInput): string | null {
  if (!svc.priceBasis.startsWith('PER_ROOM')) return null;

  const total = guests.adults + guests.children;
  if (svc.coversPersons != null && total > svc.coversPersons) {
    return `Doplata važi za najviše ${svc.coversPersons} osoba, a traženo je ${total}.`;
  }
  if (svc.maxAdults != null && guests.adults > svc.maxAdults) {
    return `Doplata važi za najviše ${svc.maxAdults} odraslih, a traženo je ${guests.adults}.`;
  }
  if (svc.maxChildren != null && guests.children > svc.maxChildren) {
    return `Doplata važi za najviše ${svc.maxChildren} dece, a traženo je ${guests.children}.`;
  }
  if (svc.childMaxAge != null && guests.childrenAges && guests.childrenAges.length > 0) {
    const limit = Number(svc.childMaxAge);
    const tooOld = guests.childrenAges.find((age) => age > limit);
    if (tooOld !== undefined) {
      return `Doplata važi za decu do ${limit} godina, a jedno dete ima ${tooOld}.`;
    }
  }
  return null;
}
