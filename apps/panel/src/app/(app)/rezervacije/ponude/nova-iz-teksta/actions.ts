'use server';

import { apiFetch, ApiError } from '@/lib/api-client';

// M5 spec §3.0j (v2.53) — ponuda iz nalepljenog teksta. Tri server akcije: izvlačenje (model
// čita, kod upari), predlog sa zvaničnog sajta (čovek dao link), i kreiranje nacrta (klik čoveka
// = jedini upis). `apiFetch` je server-only, pa i čitanja idu kroz akcije (isti obrazac kao
// `../../pretraga/actions.ts`).

export interface IntakeRoom {
  room_type_text: string | null;
  adults: number;
  children_ages: number[];
}

export interface IntakeResult {
  extraction: {
    kind: 'SUPPLIER_OFFER' | 'CLIENT_REQUEST' | 'UNCLEAR';
    property_name: string | null;
    city: string | null;
    country: string | null;
    supplier_name: string | null;
    stay_from: string | null;
    stay_to: string | null;
    nights: number | null;
    board: string | null;
    rooms: IntakeRoom[];
    price: {
      amount_text: string;
      currency: string | null;
      basis: string | null;
      per: string | null;
    } | null;
    valid_until: string | null;
    notes: string | null;
    questions: string[];
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  derived: {
    amountMinor: number | null;
    currency: string | null;
    stayFrom: string | null;
    stayTo: string | null;
    adults: number;
    children: number;
    priceRole: 'BASE_COST' | 'FINAL_PRICE' | null;
  };
  match: {
    productId: string | null;
    productName: string | null;
    matchScore: number | null;
    productStatus: string | null;
    contractId: string | null;
    hasPriceForPeriod: boolean;
    supplierId: string | null;
    supplierName: string | null;
    supplierCandidates: { id: string; name: string }[];
  };
  warnings: string[];
}

export interface SitePreview {
  url: string;
  description: string | null;
  address: string | null;
  stars: number | null;
  amenities: string[];
  warnings: string[];
}

function poruka(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | null;
    const m = body?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

export async function extractFromText(
  text: string,
  answers: string[],
): Promise<{ error: string | null; result: IntakeResult | null }> {
  try {
    const result = await apiFetch<IntakeResult>('/sales/quotes/text-intake/extract', {
      method: 'POST',
      body: { text, answers },
    });
    return { error: null, result };
  } catch (err) {
    return { error: poruka(err, 'Čitanje teksta nije uspelo.'), result: null };
  }
}

export async function previewOfficialSite(
  url: string,
): Promise<{ error: string | null; preview: SitePreview | null }> {
  try {
    const preview = await apiFetch<SitePreview>('/sales/quotes/text-intake/site-preview', {
      method: 'POST',
      body: { url },
    });
    return { error: null, preview };
  } catch (err) {
    return { error: poruka(err, 'Sajt nije pročitan.'), preview: null };
  }
}

export async function listSuppliers(): Promise<{ id: string; name: string }[]> {
  try {
    const r = await apiFetch<{ data: { id: string; name: string }[] }>(
      '/contracting/suppliers?limit=200',
    );
    return r.data.map((s) => ({ id: s.id, name: s.name }));
  } catch {
    return [];
  }
}

export interface DraftInput {
  intakeSourceText: string;
  stayFrom: string;
  stayTo: string;
  adults: number;
  childrenAges: number[];
  notes: string | null;
  /** Postojeći proizvod iz kataloga (stavka iz pretrage), ili ručna stavka. */
  productId: string | null;
  rateLineId: string | null;
  manual: {
    name: string;
    description: string | null;
    supplierId: string;
    destinationCountry: string;
    destinationCity: string;
    baseCost: number | null;
    finalPrice: number;
    currency: string;
    saveToCatalog: boolean;
    attributes: Record<string, unknown> | null;
  } | null;
}

export async function createDraftQuote(
  input: DraftInput,
): Promise<{ error: string | null; quoteId: string | null }> {
  const occupancy = {
    adults: input.adults,
    children: input.childrenAges.length,
    roomConfig: [
      {
        adults: input.adults,
        children: input.childrenAges.length,
        childrenAges: input.childrenAges,
      },
    ],
  };
  const item = input.manual
    ? {
        stayFrom: input.stayFrom,
        stayTo: input.stayTo,
        occupancy,
        manual: {
          productType: 'ACCOMMODATION',
          name: input.manual.name,
          description: input.manual.description ?? undefined,
          supplierId: input.manual.supplierId,
          destinationCountry: input.manual.destinationCountry,
          destinationCity: input.manual.destinationCity,
          baseCost: input.manual.baseCost,
          finalPrice: input.manual.finalPrice,
          currency: input.manual.currency,
          saveToCatalog: input.manual.saveToCatalog,
          attributes: input.manual.attributes,
          notes: input.notes ?? undefined,
        },
      }
    : {
        productId: input.productId,
        rateLineId: input.rateLineId ?? undefined,
        stayFrom: input.stayFrom,
        stayTo: input.stayTo,
        occupancy,
      };
  try {
    const quote = await apiFetch<{ id: string }>('/sales/quotes', {
      method: 'POST',
      body: { channel: 'INTERNAL_PANEL', intakeSourceText: input.intakeSourceText, items: [item] },
    });
    return { error: null, quoteId: quote.id };
  } catch (err) {
    return { error: poruka(err, 'Kreiranje nacrta nije uspelo.'), quoteId: null };
  }
}
