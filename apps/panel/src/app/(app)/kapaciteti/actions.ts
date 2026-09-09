'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

// M3 spec §2.8a/§2.8b — radnje sa ekrana „Kapaciteti". Standing pravilo iz CLAUDE.md ("logika i
// ekran u istom prolazu") — forme se prave zajedno sa endpoint-ima, ne kao zadatak za kasnije.

export interface CapacityFormState {
  error: string | null;
  ok: string | null;
}

function poruka(err: unknown, podrazumevana: string): string {
  if (err instanceof ApiError) {
    const telo = err.body as { message?: string | string[] } | undefined;
    const m = telo?.message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return podrazumevana;
}

/**
 * §2.8a (v1.23) — obim izmene: cipovi salju `contractPeriodIds` (vise tipova soba odjednom),
 * a forma bez cipova i dalje salje jedan `contractPeriodId`. Salje se TACNO JEDNO od to dvoje,
 * ne oba — inace bi backend spajao skupove i potez bi pogodio vise nego sto je izabrano.
 */
function periodiIz(formData: FormData): Record<string, unknown> {
  const izabrani = formData.getAll('contractPeriodIds').map(String).filter(Boolean);
  if (izabrani.length > 0) return { contractPeriodIds: izabrani };
  return { contractPeriodId: formData.get('contractPeriodId') };
}

/** §2.8a — zatvaranje prodaje; `source` (po čijoj informaciji) je obavezan izbor u formi. */
export async function stopSale(
  _prev: CapacityFormState,
  formData: FormData,
): Promise<CapacityFormState> {
  // §2.8a v1.23 — tri vrednosti obima: izabrani tipovi soba (podrazumevano, cipovi), ceo
  // objekat, ili jedan period (stari put, ostaje za pozive koji cipove nemaju).
  const obim = String(formData.get('obim') ?? 'period');
  const izabraniTipovi = formData.getAll('contractPeriodIds').map(String).filter(Boolean);
  try {
    const rezultat = await apiFetch<{ periods: number; days: number }>(
      '/contracting/capacity/stop-sale',
      {
        method: 'POST',
        body: {
          contractPeriodIds:
            obim === 'objekat' || izabraniTipovi.length === 0 ? undefined : izabraniTipovi,
          contractPeriodId:
            obim === 'objekat' || izabraniTipovi.length > 0
              ? undefined
              : formData.get('contractPeriodId'),
          contractId: obim === 'objekat' ? formData.get('contractId') : undefined,
          dateFrom: formData.get('dateFrom'),
          dateTo: formData.get('dateTo'),
          source: formData.get('source'),
          reason: formData.get('reason') || undefined,
        },
      },
    );
    revalidatePath('/kapaciteti');
    return {
      error: null,
      ok: `Prodaja zatvorena: ${rezultat.periods} ${rezultat.periods === 1 ? 'period' : 'perioda'} × ukupno ${rezultat.days} dana.`,
    };
  } catch (err) {
    return { error: poruka(err, 'Zatvaranje prodaje nije uspelo.'), ok: null };
  }
}

export async function reopenSale(
  _prev: CapacityFormState,
  formData: FormData,
): Promise<CapacityFormState> {
  try {
    const rezultat = await apiFetch<{ periods: number; days: number }>(
      '/contracting/capacity/stop-sale',
      {
        method: 'DELETE',
        body: {
          ...periodiIz(formData),
          dateFrom: formData.get('dateFrom'),
          dateTo: formData.get('dateTo'),
        },
      },
    );
    revalidatePath('/kapaciteti');
    return { error: null, ok: `Prodaja ponovo otvorena za ${rezultat.days} dana.` };
  } catch (err) {
    return { error: poruka(err, 'Ponovno otvaranje nije uspelo.'), ok: null };
  }
}

/** §2.8b — blokada; `reason` i `holdUntil` su obavezni i na backend-u, ne samo u formi. */
export async function createBlock(
  _prev: CapacityFormState,
  formData: FormData,
): Promise<CapacityFormState> {
  try {
    const rezultat = await apiFetch<{ periods?: number }>('/contracting/capacity/blocks', {
      method: 'POST',
      body: {
        ...periodiIz(formData),
        dateFrom: formData.get('dateFrom'),
        dateTo: formData.get('dateTo'),
        units: Number(formData.get('units')),
        reason: formData.get('reason'),
        holdUntil: formData.get('holdUntil'),
      },
    });
    revalidatePath('/kapaciteti');
    return {
      error: null,
      ok:
        rezultat.periods && rezultat.periods > 1
          ? `Kapacitet je blokiran u ${rezultat.periods} tipa soba.`
          : 'Kapacitet je blokiran.',
    };
  } catch (err) {
    return { error: poruka(err, 'Blokada nije uspela.'), ok: null };
  }
}

/** §2.8a — izmena kapaciteta za dan/raspon (postojeća dozvola `contract-period/EDIT`). */
export async function setCapacityOverride(
  _prev: CapacityFormState,
  formData: FormData,
): Promise<CapacityFormState> {
  const sirovo = String(formData.get('capacity') ?? '').trim();
  try {
    const rezultat = await apiFetch<{ days: number; periods: number }>(
      '/contracting/capacity/days',
      {
        method: 'PUT',
        body: {
          ...periodiIz(formData),
          dateFrom: formData.get('dateFrom'),
          dateTo: formData.get('dateTo'),
          capacity: sirovo === '' ? null : Number(sirovo),
        },
      },
    );
    revalidatePath('/kapaciteti');
    return {
      error: null,
      ok:
        (sirovo === ''
          ? `Kapacitet vraćen na ugovoreni za ${rezultat.days} dnevnih zapisa`
          : `Kapacitet postavljen na ${sirovo} za ${rezultat.days} dnevnih zapisa`) +
        (rezultat.periods > 1 ? ` (${rezultat.periods} tipa soba).` : '.'),
    };
  } catch (err) {
    return { error: poruka(err, 'Izmena kapaciteta nije uspela.'), ok: null };
  }
}
