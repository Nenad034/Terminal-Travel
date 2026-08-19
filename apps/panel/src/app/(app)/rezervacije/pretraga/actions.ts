'use server';

import { apiFetch, ApiError } from '@/lib/api-client';

export interface CreateQuoteState {
  error: string | null;
  quoteId?: string;
}

// M5 spec §3.0b.3/§3.1 — polja stavke se prepisuju iz izabranog SearchResultOffer,
// korisnik ih ne unosi ručno (docs/api/M5-rezervacije.md, POST /quotes).
export async function createQuoteFromOffer(_prev: CreateQuoteState, formData: FormData): Promise<CreateQuoteState> {
  const adults = Number(formData.get('adults'));
  const children = Number(formData.get('children'));
  const stayFrom = formData.get('stayFrom') as string;
  const stayTo = formData.get('stayTo') as string;

  if (!stayFrom || !stayTo) {
    return { error: 'Izaberite period boravka (od/do) pre kreiranja ponude.' };
  }

  let quoteId: string;
  try {
    const quote = await apiFetch<{ id: string }>('/sales/quotes', {
      method: 'POST',
      body: {
        channel: 'INTERNAL_PANEL',
        items: [
          {
            productId: formData.get('productId'),
            rateLineId: formData.get('rateLineId') || undefined,
            providerQuoteReference: formData.get('providerQuoteReference') || undefined,
            stayFrom,
            stayTo,
            occupancy: { adults, children, roomConfig: [{ adults, children, childrenAges: [] }] },
          },
        ],
      },
    });
    quoteId = quote.id;
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje ponude nije uspelo.' };
  }
  // docs/analize/29-DIZAJN-SISTEM-UI.md §5a — kreiranje ponude iz pretrage je drill-down,
  // ostaje u istom tabu. Server Action se ne redirektuje sam (to bi otvorilo nov tab preko
  // RegisterTab efekta) — vraća quoteId, klijentska komponenta (QuoteButton) navigira kroz
  // navigateInTab.
  return { error: null, quoteId };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
