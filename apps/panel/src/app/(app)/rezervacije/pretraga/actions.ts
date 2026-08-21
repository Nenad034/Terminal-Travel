'use server';

import { apiFetch, ApiError } from '@/lib/api-client';
import type { SelectionItem } from '@/components/SelectionContext';

export interface CreateQuoteState {
  error: string | null;
  quoteId?: string;
}

// M5 spec §3.0e.3 — desni panel skuplja stavke iz pretrage pre nego što se stvarno napravi
// Ponuda; ovaj poziv je trenutak kad selekcija konačno postaje pravi POST /quotes zapis,
// sa svim stavkama u jednom pozivu (isti endpoint kao pojedinačan slučaj, samo duži niz).
export async function createQuoteFromSelection(items: SelectionItem[]): Promise<CreateQuoteState> {
  if (items.length === 0) return { error: 'Selekcija je prazna.' };
  if (items.some((i) => !i.stayFrom || !i.stayTo)) {
    return { error: 'Izaberite period boravka (od/do) pre kreiranja ponude.' };
  }

  let quoteId: string;
  try {
    const quote = await apiFetch<{ id: string }>('/sales/quotes', {
      method: 'POST',
      body: {
        channel: 'INTERNAL_PANEL',
        items: items.map((i) => ({
          productId: i.productId,
          rateLineId: i.rateLineId || undefined,
          providerQuoteReference: i.providerQuoteReference || undefined,
          stayFrom: i.stayFrom,
          stayTo: i.stayTo,
          occupancy: { adults: i.adults, children: i.children, roomConfig: [{ adults: i.adults, children: i.children, childrenAges: [] }] },
        })),
      },
    });
    quoteId = quote.id;
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje ponude nije uspelo.' };
  }
  return { error: null, quoteId };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
