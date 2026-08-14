'use server';

import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface ConfirmState {
  error: string | null;
}

// M5 spec §4 — POST /quotes/:id/confirm (docs/api/M5-rezervacije.md). buyerName/buyerType
// su OBAVEZNI u ConfirmQuoteDto (M10 fiskalizacija, §4.1 dopuna v1.17) — contractTermsAccepted
// NIJE polje ovog DTO-a (whitelist:true/forbidNonWhitelisted:true u main.ts bi odbio zahtev
// da je pošaljemo ovde); prihvatanje uslova ugovora se beleži pri kreiranju Quote-a (§3.1).
export async function confirmQuote(quoteId: string, itemCount: number, _prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  const guests = Array.from({ length: itemCount }).map((_, i) => ({
    itemIndex: i,
    firstName: formData.get(`firstName-${i}`),
    lastName: formData.get(`lastName-${i}`),
  }));
  const buyerType = formData.get('buyerType') as string;

  let bookingId: string;
  try {
    const booking = await apiFetch<{ id: string }>(`/sales/quotes/${quoteId}/confirm`, {
      method: 'POST',
      body: {
        guests,
        buyerName: formData.get('buyerName'),
        buyerType,
        buyerTaxId: buyerType === 'PRAVNO_LICE' ? formData.get('buyerTaxId') || undefined : undefined,
      },
    });
    bookingId = booking.id;
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Potvrda rezervacije nije uspela.' };
  }
  redirect(`/rezervacije/${bookingId}`);
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
