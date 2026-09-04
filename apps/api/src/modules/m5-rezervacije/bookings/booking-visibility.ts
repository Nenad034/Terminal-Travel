// M5 spec §6.2 — "identitet dobavljača se nikad ne izlaže B2C/B2B/gost kanalima." Vaučer,
// pregled rezervacije koji vidi gost (M8/M9) ili B2B subagent (M7), i svaki M5 API odgovor
// ka tim kanalima NIKAD ne sadrže BookingItem.supplier_reference niti bilo koje polje iz
// M3 Supplier/Contract. Sprovođenje je eksplicitno ovde (whitelist pristup), ne oslanja se
// na to da front-end prosto ne prikaže polje.

export type M5ApiContext = 'INTERNAL_PANEL' | 'B2C' | 'B2B' | 'MOBILE_GUEST';

const INTERNAL_CONTEXTS: M5ApiContext[] = ['INTERNAL_PANEL'];

export function isInternalContext(context: M5ApiContext): boolean {
  return INTERNAL_CONTEXTS.includes(context);
}

export interface RawBookingItem {
  id: string;
  bookingId: string;
  productId: string;
  sourceType: string;
  supplierReference: string;
  stayFrom: Date;
  stayTo: Date;
  baseCost: number;
  baseCostCurrency: string;
  rateLineId: string | null;
  markupRuleId: string;
  finalPrice: number;
  finalPriceCurrency: string;
  itemStatus: string;
  cancellationRefundPercentage: number | null;
  assignedGuideId: string | null;
  duplicateConflictItemId: string | null;
  duplicateCheckOverriddenBy: string | null;
  duplicateCheckOverriddenAt: Date | null;
  announcedAt: Date | null;
  supplierConfirmedAt: Date | null;
  supplierConfirmedBy: string | null;
  // §4.5 dopuna (1.9.2026) — šta je STVARNO kupljeno i ko putuje. Do ove dopune je
  // `GET /bookings/:id` vraćao samo `productId` (sirov UUID) i nijednog putnika, pa ni
  // interni panel ni gost nisu mogli da vide naziv aranžmana ni spisak putnika.
  product?: BookingItemProduct | null;
  guests?: BookingItemGuestView[];
  [key: string]: unknown;
}

/** Naziv/tip/destinacija kupljenog proizvoda. Naziv je već razrešen po jeziku (M2 §2.2
 * fallback), pa pozivalac ne mora da zna za `ProductTranslation`. */
export interface BookingItemProduct {
  id: string;
  type: string;
  name: string | null;
  destinationCity: string | null;
  destinationCountry: string | null;
  // M2 spec §2.1b (4.9.2026) — regija/poluostrvo KAD se razlikuje od destinationCity
  // (npr. "Sitonija, Halkidiki"). Nije osetljiv podatak (za razliku od dobavljača, §6.2) —
  // sme svuda gde i destinationCity.
  destinationArea?: string | null;
}

export interface BookingItemGuestView {
  id: string;
  guestFirstName: string;
  guestLastName: string;
  guestProfileId: string | null;
}

// Polja koja SME da vidi gost/B2B subagent — "proizvod, datumi, cena za gosta/subagenta i
// status — ono što je već prirodan sadržaj vaučera/pregleda" (§6.2).
export function toPublicBookingItem(item: RawBookingItem) {
  return {
    id: item.id,
    productId: item.productId,
    sourceType: item.sourceType,
    stayFrom: item.stayFrom,
    stayTo: item.stayTo,
    finalPrice: item.finalPrice,
    finalPriceCurrency: item.finalPriceCurrency,
    itemStatus: item.itemStatus,
    cancellationRefundPercentage: item.cancellationRefundPercentage,
    unitCount: item.unitCount,
    // §6.2 dozvoljava gostu/subagentu "proizvod, datume, cenu i status" — naziv proizvoda i
    // spisak putnika su prirodan sadržaj vaučera, isti podatak koji gost ionako drži u ruci.
    // Identitet DOBAVLJAČA i dalje ne izlazi (`supplierReference`, `baseCost`, `markupRuleId`
    // ostaju van ove liste), što je ono što §6.2 zapravo štiti.
    product: item.product ?? null,
    guests: item.guests ?? [],
  };
}

export function toInternalBookingItem(item: RawBookingItem) {
  return item;
}

export function serializeBookingItem(item: RawBookingItem, context: M5ApiContext) {
  return isInternalContext(context) ? toInternalBookingItem(item) : toPublicBookingItem(item);
}

export interface RawBooking {
  items: RawBookingItem[];
  [key: string]: unknown;
}

// §6.2 primenjeno na ceo Booking odgovor (npr. GET /bookings/:id, vaučer payload).
export function serializeBooking(booking: RawBooking, context: M5ApiContext) {
  return {
    ...booking,
    items: booking.items.map((item) => serializeBookingItem(item, context)),
  };
}
