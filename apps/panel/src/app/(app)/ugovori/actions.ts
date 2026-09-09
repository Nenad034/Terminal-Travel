'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { AgePolicyOverrideEntry } from './[id]/PeriodsPanel';

export interface FormState {
  error: string | null;
}

// M3 spec §2.3/§2.3b — POST /contracting/contracts/:id/periods odbija period koji se datumski
// preklapa sa postojećim za isti room_type (overlap.ts) — greška se prosleđuje kao i svaka druga.
export async function createPeriod(
  contractId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const allotmentMode = String(formData.get('allotmentMode'));
  try {
    const agePolicyRaw = String(formData.get('agePolicyOverride') ?? '');
    let agePolicyOverride: AgePolicyOverrideEntry[] | undefined;
    if (agePolicyRaw.trim()) {
      agePolicyOverride = JSON.parse(agePolicyRaw);
    }
    await apiFetch(`/contracting/contracts/${contractId}/periods`, {
      method: 'POST',
      body: {
        stayFrom: formData.get('stayFrom'),
        stayTo: formData.get('stayTo'),
        roomType: formData.get('roomType'),
        allotmentMode,
        totalCapacity:
          allotmentMode !== 'ON_REQUEST' ? Number(formData.get('totalCapacity')) : undefined,
        releaseDaysBefore:
          allotmentMode === 'FIXED' && formData.get('releaseDaysBefore')
            ? Number(formData.get('releaseDaysBefore'))
            : undefined,
        ukupnaFiksnaObaveza:
          allotmentMode === 'CHARTER' || allotmentMode === 'FIXED_LEASE'
            ? Number(formData.get('ukupnaFiksnaObaveza'))
            : undefined,
        fixedObligationCurrency:
          allotmentMode === 'CHARTER' || allotmentMode === 'FIXED_LEASE'
            ? formData.get('fixedObligationCurrency')
            : undefined,
        agePolicyOverride,
        minStayNights: formData.get('minStayNights')
          ? Number(formData.get('minStayNights'))
          : undefined,
        maxStayNights: formData.get('maxStayNights')
          ? Number(formData.get('maxStayNights'))
          : undefined,
      },
    });
    revalidatePath(`/ugovori/${contractId}`);
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje perioda nije uspelo.',
    };
  }
  return { error: null };
}

// M3 spec §2.3d (v1.16, 8.9.2026) — izmena postojećeg perioda. Backend odbija smanjenje
// kapaciteta ispod već prodatog dok se ne pošalje `confirmOversold` — ekran tu grešku prikazuje
// kao pitanje sa drugim dugmetom, ne kao kvar (vlasnikova odluka: dozvoliti, ali nikad slučajno).
export async function updatePeriod(
  contractId: string,
  periodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const num = (name: string): number | null | undefined => {
    const raw = formData.get(name);
    if (raw === null) return undefined;
    const text = String(raw).trim();
    if (text === '') return null;
    return Number(text);
  };
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}`, {
      method: 'PATCH',
      body: {
        stayFrom: formData.get('stayFrom') || undefined,
        stayTo: formData.get('stayTo') || undefined,
        roomType: formData.get('roomType') || undefined,
        totalCapacity: num('totalCapacity'),
        releaseDaysBefore: num('releaseDaysBefore'),
        minStayNights: num('minStayNights'),
        maxStayNights: num('maxStayNights'),
        confirmOversold: formData.get('confirmOversold') === 'da' ? true : undefined,
      },
    });
    revalidatePath(`/ugovori/${contractId}`);
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Izmena perioda nije uspela.',
    };
  }
  return { error: null };
}

// §2.3d — period sa rezervacijama se GASI (INACTIVE), bez njih se briše. Odluku donosi backend
// (broji `BookingItem` preko `RateLine`), ekran samo prikazuje šta se desilo.
export async function deletePeriod(
  contractId: string,
  periodId: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}`, {
      method: 'DELETE',
    });
    revalidatePath(`/ugovori/${contractId}`);
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Gašenje perioda nije uspelo.',
    };
  }
  return { error: null };
}

/**
 * M3 §2.4c (v1.25) — čitanje cena iz forme. Isto telo ide i pri dodavanju i pri ispravci, pa
 * stoji na jednom mestu: dva različita čitanja iste forme se pre ili kasnije raziđu.
 *
 * `age_pricing[]` (cena po uzrastu — §2.4a) je do 9.9.2026 bio API-only i forma ga nije imala,
 * pa se dečja cena uopšte nije mogla uneti iz panela. Redovi stižu kao paralelni nizovi
 * (`agePricingCategory[]`, `agePricingMode[]`…), jer HTML forma nema ugnježdene objekte —
 * spajaju se po indeksu, a prazan red se preskače da prazan obrazac ne bi upisao smeće.
 */
function rateLineBodyFrom(formData: FormData): Record<string, unknown> {
  const kategorije = formData.getAll('agePricingCategory').map(String);
  const rezimi = formData.getAll('agePricingMode').map(String);
  const procenti = formData.getAll('agePricingPercentage').map(String);
  const fiksne = formData.getAll('agePricingFlatPrice').map(String);
  const minOdraslih = formData.getAll('agePricingMinAdults').map(String);

  const agePricing = kategorije
    .map((ageCategory, i) => ({
      ageCategory,
      pricingMode: rezimi[i] ?? 'PERCENTAGE_OF_BASE_PRICE',
      percentage:
        rezimi[i] === 'PERCENTAGE_OF_BASE_PRICE' && procenti[i] !== '' ? Number(procenti[i]) : null,
      flatPrice:
        rezimi[i] === 'FLAT_PRICE_PER_NIGHT' && fiksne[i] !== '' ? Number(fiksne[i]) : null,
      minAdultsPresent: minOdraslih[i] && minOdraslih[i] !== '' ? Number(minOdraslih[i]) : null,
      occupantIndex: null,
    }))
    // Red bez kategorije ili bez ijedne vrednosti je prazan obrazac, ne podatak.
    .filter((a) => a.ageCategory && (a.percentage !== null || a.flatPrice !== null));

  return {
    boardType: formData.get('boardType'),
    occupancy: formData.get('occupancy'),
    priceBasis: formData.get('priceBasis'),
    price: Number(formData.get('price')),
    cribFeePerNight: formData.get('cribFeePerNight')
      ? Number(formData.get('cribFeePerNight'))
      : undefined,
    agePricing: agePricing.length > 0 ? agePricing : undefined,
  };
}

/**
 * §2.4c — GAŠENJE cenovne stavke. Zapis ostaje u bazi; pretraga i ponuda od v1.25 gledaju
 * isključivo `ACTIVE`, pa ugašena cena prestaje da se prodaje istog trenutka.
 */
export async function deactivateRateLine(
  contractId: string,
  periodId: string,
  rateLineId: string,
): Promise<void> {
  await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/rates/${rateLineId}`, {
    method: 'DELETE',
  });
  revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
}

/**
 * §2.4c — ISPRAVKA: jedan poziv, jedna transakcija na backendu (gasi staru, upisuje novu sa
 * `replacesId`). Namerno NIJE „obriši pa dodaj" iz panela — prekid između dva poziva ostavio
 * bi period bez ijedne važeće cene.
 */
export async function replaceRateLine(
  contractId: string,
  periodId: string,
  rateLineId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(
      `/contracting/contracts/${contractId}/periods/${periodId}/rates/${rateLineId}/replace`,
      { method: 'PUT', body: rateLineBodyFrom(formData) },
    );
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Ispravka cenovne stavke nije uspela.',
    };
  }
  return { error: null };
}

export async function addRateLine(
  contractId: string,
  periodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/rates`, {
      method: 'PUT',
      body: rateLineBodyFrom(formData),
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return {
      error:
        err instanceof ApiError ? extractMessage(err) : 'Dodavanje cenovne stavke nije uspelo.',
    };
  }
  return { error: null };
}

// M3 spec §2.5 dopuna v1.12 — ruleType razdvaja PRE_ARRIVAL (postojeća polja) od EARLY_DEPARTURE
// (kazna za skraćenje već započetog boravka, nova polja). Panel prosleđuje samo skup polja koji
// odgovara izabranom ruleType-u (isti obrazac kao backend DTO @ValidateIf).
export async function addCancellationRule(
  contractId: string,
  periodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ruleType = String(formData.get('ruleType') ?? 'PRE_ARRIVAL');
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/cancellation-rules`, {
      method: 'PUT',
      body: {
        ruleType,
        daysBeforeStay:
          ruleType === 'PRE_ARRIVAL' ? Number(formData.get('daysBeforeStay')) : undefined,
        refundPercentage:
          ruleType === 'PRE_ARRIVAL' ? Number(formData.get('refundPercentage')) : undefined,
        earlyDepartureBasis:
          ruleType === 'EARLY_DEPARTURE' ? formData.get('earlyDepartureBasis') : undefined,
        earlyDeparturePercentage:
          ruleType === 'EARLY_DEPARTURE' &&
          formData.get('earlyDepartureBasis') === 'PERCENTAGE_OF_REMAINING_STAY'
            ? Number(formData.get('earlyDeparturePercentage'))
            : undefined,
        earlyDepartureFlatAmount:
          ruleType === 'EARLY_DEPARTURE' && formData.get('earlyDepartureBasis') === 'FLAT_AMOUNT'
            ? Number(formData.get('earlyDepartureFlatAmount'))
            : undefined,
      },
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return {
      error:
        err instanceof ApiError
          ? extractMessage(err)
          : 'Dodavanje pravila otkazivanja nije uspelo.',
    };
  }
  return { error: null };
}

// M3 spec §2.4b dopuna v1.12 — PUT uvek kreira novi red (isti obrazac kao addRateLine).
// `validArrivalWeekdays`/`excludedRoomTypes` su API-only za sada (nisu u formi), isti princip
// kao `age_pricing[]` u RateLinesPanel.tsx.
export async function addOffer(
  contractId: string,
  periodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const offerType = String(formData.get('offerType'));
  const discountType = formData.get('discountType')
    ? String(formData.get('discountType'))
    : undefined;
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/offers`, {
      method: 'PUT',
      body: {
        offerType,
        bookingFrom: formData.get('bookingFrom'),
        bookingTo: formData.get('bookingTo'),
        discountType: offerType === 'EARLY_BOOKING' ? discountType : undefined,
        discountPercentage:
          offerType === 'EARLY_BOOKING' && discountType === 'PERCENTAGE'
            ? Number(formData.get('discountPercentage'))
            : undefined,
        discountAmount:
          offerType === 'EARLY_BOOKING' && discountType === 'FIXED_AMOUNT'
            ? Number(formData.get('discountAmount'))
            : undefined,
        stayNights: offerType === 'FREE_NIGHTS' ? Number(formData.get('stayNights')) : undefined,
        payNights: offerType === 'FREE_NIGHTS' ? Number(formData.get('payNights')) : undefined,
        depositPercentage: formData.get('depositPercentage')
          ? Number(formData.get('depositPercentage'))
          : undefined,
        depositDeadline: formData.get('depositDeadline')
          ? formData.get('depositDeadline')
          : undefined,
        minAge: formData.get('minAge') ? Number(formData.get('minAge')) : undefined,
        maxAge: formData.get('maxAge') ? Number(formData.get('maxAge')) : undefined,
        combinableWithOtherOffers: formData.get('combinableWithOtherOffers') === 'true',
      },
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Dodavanje ponude nije uspelo.',
    };
  }
  return { error: null };
}

// M3 spec §2.6 dopuna v1.12 — PUT uvek kreira novi red (isti obrazac kao addRateLine).
export async function addAncillaryService(
  contractId: string,
  periodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const pricingMode = String(formData.get('pricingMode'));
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/ancillary-services`, {
      method: 'PUT',
      body: {
        name: formData.get('name'),
        pricingMode,
        flatAmount:
          pricingMode === 'FLAT_PER_UNIT' ? Number(formData.get('flatAmount')) : undefined,
        percentageOfNightlyRate:
          pricingMode === 'PERCENTAGE_OF_NIGHTLY_RATE'
            ? Number(formData.get('percentageOfNightlyRate'))
            : undefined,
        // M3 §2.6 v1.13 (3.9.2026) — osnova je PAR (osoba/soba × dan/period), doplata ili
        // popust, granice po sastavu gostiju, i mesto plaćanja. `coversPersons` se šalje samo
        // uz osnovu po sobi — backend ga tamo i traži (za osnovu po osobi nema smisla).
        kind: formData.get('kind'),
        priceBasis: formData.get('priceBasis'),
        coversPersons: formData.get('coversPersons')
          ? Number(formData.get('coversPersons'))
          : undefined,
        maxAdults: formData.get('maxAdults') ? Number(formData.get('maxAdults')) : undefined,
        maxChildren: formData.get('maxChildren') ? Number(formData.get('maxChildren')) : undefined,
        childMaxAge: formData.get('childMaxAge') ? Number(formData.get('childMaxAge')) : undefined,
        payable: formData.get('payable'),
        isMandatory: formData.get('isMandatory') === 'true',
        isRefundable: formData.get('isRefundable') === 'true',
        maxQuantity: formData.get('maxQuantity') ? Number(formData.get('maxQuantity')) : undefined,
        notes: formData.get('notes') ? formData.get('notes') : undefined,
      },
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return {
      error:
        err instanceof ApiError ? extractMessage(err) : 'Dodavanje dodatne usluge nije uspelo.',
    };
  }
  return { error: null };
}

// M3 spec §2.7 dopuna v1.12 — jedan zapis po periodu (1:1), PUT radi pravi upsert na backend-u
// (izmena ako postoji, kreiranje ako ne). Isključivo informativno — vidi napomenu u TouristTaxPanel.
export async function saveTouristTax(
  contractId: string,
  periodId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const includedInPrice = formData.get('includedInPrice') === 'true';
  try {
    await apiFetch(`/contracting/contracts/${contractId}/periods/${periodId}/tourist-tax`, {
      method: 'PUT',
      body: {
        includedInPrice,
        collectedBy: !includedInPrice ? formData.get('collectedBy') : undefined,
        amountPerNight:
          !includedInPrice && formData.get('amountPerNight')
            ? Number(formData.get('amountPerNight'))
            : undefined,
        currency: !includedInPrice ? formData.get('currency') : undefined,
        taxExemptMaxAge: formData.get('taxExemptMaxAge')
          ? Number(formData.get('taxExemptMaxAge'))
          : undefined,
        notes: formData.get('notes') ? formData.get('notes') : undefined,
      },
    });
    revalidatePath(`/ugovori/${contractId}/periods/${periodId}`);
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Čuvanje boravišne takse nije uspelo.',
    };
  }
  return { error: null };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
