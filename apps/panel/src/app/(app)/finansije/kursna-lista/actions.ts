'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
  ok: boolean;
}

/**
 * Ručni unos kursa (M10 spec §3.1/§3.1a, `POST /finance/exchange-rates`, dozvola
 * `M10/exchange-rate/EDIT`).
 *
 * ZAŠTO OVAJ EKRAN POSTOJI (6.9.2026, na zahtev vlasnika): kurs se povlači automatski svako
 * jutro, a od 6.9.2026. sistem sam popunjava i propuštene dane unazad. Ali izvor je javna
 * stranica čiji format nije ugovoren — ako se promeni, uvoz staje. Do danas u tom slučaju nije
 * postojao NIJEDAN način da čovek vidi šta u kursnoj listi ima, ni da upiše kurs ručno: API je
 * postojao, ekran nije. Nedostatak se ne primećuje dok automatika radi, a primeti se tačno u
 * trenutku kad zakaže — što je i jedini trenutak kad ručni unos treba.
 *
 * `source` se NE prima iz forme: API svaki ručni upis obeležava kao `MANUAL`, i to je namerno —
 * po zapisu se posle vidi šta je došlo iz NBS-a, a šta je čovek uneo.
 */
export async function createExchangeRate(_prev: FormState, formData: FormData): Promise<FormState> {
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase();
  const rateDate = String(formData.get('rateDate') ?? '').trim();
  const rawRate = String(formData.get('nbsMiddleRate') ?? '').trim().replace(',', '.');

  if (!currency) return { error: 'Izaberite valutu.', ok: false };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rateDate)) return { error: 'Datum mora biti u obliku GGGG-MM-DD.', ok: false };
  const nbsMiddleRate = Number(rawRate);
  if (!Number.isFinite(nbsMiddleRate) || nbsMiddleRate <= 0) {
    return { error: 'Kurs mora biti broj veći od nule (npr. 117,3707).', ok: false };
  }

  try {
    await apiFetch('/finance/exchange-rates', {
      method: 'POST',
      body: { currency, rateDate, nbsMiddleRate },
    });
  } catch (err) {
    if (err instanceof ApiError) {
      // Jedinstveni indeks (currency, rate_date) — dan koji već ima kurs se ne prepisuje.
      // Poruka mora reći ŠTA da se uradi, ne samo da nije uspelo.
      if (err.status === 409) {
        return { error: `Kurs za ${currency} na dan ${rateDate} već postoji — postojeći se ne prepisuje.`, ok: false };
      }
      return { error: extractMessage(err), ok: false };
    }
    return { error: 'Unos kursa nije uspeo.', ok: false };
  }

  revalidatePath('/finansije/kursna-lista');
  return { error: null, ok: true };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
