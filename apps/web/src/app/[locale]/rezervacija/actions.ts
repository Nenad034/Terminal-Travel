'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getSession } from '@/lib/session';
import type { Quote } from '@/lib/types';

/**
 * M8 spec poglavlje 3 — implementaciona napomena (avgust 2026). M5 `POST /quotes` je
 * jedino mesto gde se `Quote.contract_terms_accepted` sme postaviti (nema PATCH
 * endpoint — M5 spec §3.1); zato se sama Ponuda (M5 `Quote` zapis) kreira tek na
 * strani "/rezervacija/uslovi" (korak 4, klik na "Prihvatam"), ne na "/rezervacija/ponuda"
 * (korak 2, koji je čisti pregled preko GET /sales/search bez upisa). Ruta/redosled
 * ekrana iz spec-a ostaje isti, samo trenutak stvarnog API poziva je pomeren unutar njih.
 * Zabeleženo kao poznato ograničenje — čist rešiv dodavanjem PATCH /quotes/:id kasnije.
 */

export async function acceptTermsAndCreateQuoteAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale'));
  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/nalog/prijava`);
  }

  const productId = String(formData.get('productId'));
  const stayFrom = String(formData.get('stayFrom'));
  const stayTo = String(formData.get('stayTo'));
  const adults = Number(formData.get('adults') ?? 2);
  const children = Number(formData.get('children') ?? 0);
  const buyerName = String(formData.get('buyerName'));
  // M8 spec poglavlje 3, korak 0 — ?ref= zabeležen ranije u middleware.ts, prenosi se
  // u Quote.referral_tracking_code (M5 spec §3.1) samo pri kreiranju, čist prolazan string.
  const referralTrackingCode = (await cookies()).get('tt_ref')?.value;

  const quote = await apiFetch<Quote>('/sales/quotes', {
    method: 'POST',
    body: {
      channel: 'B2C_SITE',
      contractTermsAccepted: true,
      items: [{ productId, stayFrom, stayTo, occupancy: { adults, children } }],
      ...(referralTrackingCode ? { referralTrackingCode } : {}),
    },
  });

  redirect(
    `/${locale}/rezervacija/placanje?quoteId=${quote.id}&buyerName=${encodeURIComponent(buyerName)}`,
  );
}

export async function payByBankTransferAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale'));
  const quoteId = String(formData.get('quoteId'));
  const buyerName = String(formData.get('buyerName'));

  // M8 spec poglavlje 3, korak 5 — bankovni prenos: rezervacija se potvrđuje odmah,
  // payment_status ostaje UNPAID dok uplata ne stigne.
  const booking = await apiFetch<{ id: string }>(`/sales/quotes/${quoteId}/confirm`, {
    method: 'POST',
    body: { buyerName, buyerType: 'FIZICKO_LICE' },
  });

  redirect(`/${locale}/rezervacija/potvrda?bookingId=${booking.id}&nacin=bank`);
}

export async function payByCardAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale'));
  const quoteId = String(formData.get('quoteId'));
  const buyerName = String(formData.get('buyerName'));

  try {
    const initiated = await apiFetch<{ gatewayTransactionId: string }>('/finance/payments/card/initiate', {
      method: 'POST',
      body: { quoteId, idempotencyKey: `${quoteId}-card` },
      auth: false,
    });

    // M10 spec §12 — stvaran platni provajder još nije izabran; mock gateway nema
    // hostovanu formu (initiate ne vraća redirectUrl) niti stvaran webhook poziv od
    // provajdera. Dok se provajder ne izabere, M8 sam poziva webhook odmah posle
    // initiate (isti podaci koje bi u produkciji poslao provajder) da bi ceo lanac
    // initiate → webhook → M5 potvrda bio proverljiv end-to-end već sada. OVO SE MORA
    // zameniti stvarnim hostovanim checkout tokom čim provajder bude izabran.
    const booking = await apiFetch<{ bookingId: string }>('/finance/payments/card/webhook', {
      method: 'POST',
      body: { gatewayTransactionId: initiated.gatewayTransactionId, buyerName, buyerType: 'FIZICKO_LICE' },
      auth: false,
    });

    redirect(`/${locale}/rezervacija/potvrda?bookingId=${booking.bookingId}&nacin=card`);
  } catch (err) {
    if (err instanceof ApiError) {
      redirect(`/${locale}/rezervacija/placanje?quoteId=${quoteId}&buyerName=${encodeURIComponent(buyerName)}&greska=1`);
    }
    throw err;
  }
}
