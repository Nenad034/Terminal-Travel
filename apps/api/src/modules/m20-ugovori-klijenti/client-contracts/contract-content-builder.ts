import { ContractType } from '@prisma/client';

// M20 spec §2.2/§2.3 — sastavlja contract_type i sadržaj ugovora ISKLJUČIVO iz već postojećih
// podataka (M2/M3/M5/M11), nikad ne izmišlja/dopunjava ručno. Čist, testabilan izračun bez
// pristupa bazi — pozivalac (ClientContractsService) učitava sve potrebno unapred, isti obrazac
// kao matching.ts (M10 supplier-invoice-imports).

export interface BookingItemForContract {
  id: string;
  itemStatus: string;
  stayFrom: Date;
  stayTo: Date;
  cancellationPolicySnapshot: unknown;
  product: {
    type: string;
    attributes: Record<string, unknown>;
    translations: { languageCode: string; name: string }[];
  };
  rateLine: {
    boardType: string;
    contractPeriod: { cancellationRules: { daysBeforeStay: number; refundPercentage: number }[] };
  } | null;
}

export interface BookingForContract {
  id: string;
  tipNastupanja: 'ORGANIZATOR' | 'POSREDNIK';
  totalPrice: number;
  currency: string;
  items: BookingItemForContract[];
}

export interface TravelGuaranteeForContract {
  provider: string;
  policyNumber: string;
}

export interface ClientPaymentScheduleForContract {
  depositAmount: number;
  depositDueDate: Date;
  balanceDueDate: Date;
}

export interface AgencyStaticInfo {
  agencyName: string;
  agencyAddress: string;
  agencyLicenseNumber: string;
  emergencyContact: string;
  priceChangeComplaintDeadlineDays: number;
}

// §2.2 — određuje contract_type iz tip_nastupanja i tipa proizvoda. Vraća null za slučajeve
// koji su eksplicitno van obima automatskog generisanja (§8): samo-INSURANCE rezervacije
// (posredovanje u osiguranju, čeka potvrdu pravnika) i KORPORATIVNI_OKVIRNI (nema definisan
// okidač za detekciju u ovoj verziji).
export function determineContractType(booking: BookingForContract): ContractType | null {
  const productTypes = new Set(booking.items.map((i) => i.product.type));

  if (productTypes.size === 1 && productTypes.has('INSURANCE')) return null;

  if (booking.tipNastupanja === 'POSREDNIK') return 'POSREDOVANJE';

  // ORGANIZATOR ostatak — dopuna (implementacija, avgust 2026): tabela §2.2 ne adresira
  // eksplicitno mešovite korpe; pravilo ispod je najuži razuman izbor koji ne krši tabelu —
  // "prava organizacija putovanja" (PACKAGE/ACCOMMODATION/EXCURSION) uvek pobeđuje samostalnu
  // prodaju karte/transfera kad su kombinovani u istoj rezervaciji.
  const hasTravelOrganizationItem = booking.items.some((i) =>
    ['PACKAGE', 'ACCOMMODATION', 'EXCURSION'].includes(i.product.type),
  );
  if (hasTravelOrganizationItem) return 'ORGANIZOVANO_PUTOVANJE';

  if (productTypes.size === 1 && productTypes.has('FLIGHT')) return 'PRODAJA_AVIO_KARTE';
  if (productTypes.size === 1 && productTypes.has('TRANSFER')) return 'TRANSFER';

  return 'ORGANIZOVANO_PUTOVANJE';
}

function productName(product: BookingItemForContract['product']): string {
  const sr = product.translations.find((t) => t.languageCode === 'sr');
  return sr?.name ?? product.translations[0]?.name ?? '(naziv nije dostupan)';
}

// §2.3 — obavezni elementi, popunjeni isključivo iz already-postojećih podataka.
export function buildContentSnapshot(params: {
  booking: BookingForContract;
  contractType: ContractType;
  travelGuarantee: TravelGuaranteeForContract | null;
  paymentSchedule: ClientPaymentScheduleForContract | null;
  agency: AgencyStaticInfo;
}): Record<string, unknown> {
  const { booking, contractType, travelGuarantee, paymentSchedule, agency } = params;

  const itineraryItems = booking.items.filter((i) => ['PACKAGE', 'EXCURSION'].includes(i.product.type));
  const accommodationItems = booking.items.filter((i) => i.product.type === 'ACCOMMODATION');
  const transportItems = booking.items.filter((i) => ['TRANSPORT', 'TRANSFER', 'FLIGHT'].includes(i.product.type));

  return {
    agency: {
      name: agency.agencyName,
      address: agency.agencyAddress,
      licenseNumber: agency.agencyLicenseNumber,
      emergencyContact: agency.emergencyContact,
    },
    contractType,
    price: { totalPrice: booking.totalPrice, currency: booking.currency },
    // §2.3 — samo za PACKAGE/EXCURSION, koji jedini imaju attributes.itinerary (M2 §2.3);
    // izostaje kao neprimenjiv element za čist ACCOMMODATION bez paketa.
    itinerary: itineraryItems.length
      ? itineraryItems.map((i) => ({ productName: productName(i.product), itinerary: i.product.attributes.itinerary ?? null }))
      : null,
    accommodation: accommodationItems.map((i) => ({
      productName: productName(i.product),
      stars: i.product.attributes.stars ?? null,
      boardType: i.rateLine?.boardType ?? null,
      stayFrom: i.stayFrom,
      stayTo: i.stayTo,
    })),
    transport: transportItems.map((i) => ({
      productName: productName(i.product),
      productType: i.product.type,
      attributes: i.product.attributes,
    })),
    cancellationTerms: booking.items.map((i) => ({
      bookingItemId: i.id,
      // CONTRACTED stavke: uživo iz M3 CancellationRule preko rate_line_id; API stavke: snimak
      // iz trenutka građenja stavke (M5 §4.2 dopuna v1.14) — nikad se ponovo ne poziva provajder.
      rules: i.rateLine ? i.rateLine.contractPeriod.cancellationRules : i.cancellationPolicySnapshot,
    })),
    travelGuarantee:
      contractType === 'ORGANIZOVANO_PUTOVANJE' && travelGuarantee
        ? { provider: travelGuarantee.provider, policyNumber: travelGuarantee.policyNumber }
        : null,
    paymentSchedule: paymentSchedule
      ? {
          depositAmount: paymentSchedule.depositAmount,
          depositDueDate: paymentSchedule.depositDueDate,
          balanceDueDate: paymentSchedule.balanceDueDate,
        }
      : null,
    priceChangeComplaintDeadlineDays: agency.priceChangeComplaintDeadlineDays,
  };
}
