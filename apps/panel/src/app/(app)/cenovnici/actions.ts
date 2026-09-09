'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

// M3 spec §4.2/§4.2.6 — AI uvoz cenovnika. Backend tok je postojao od v1.7 kao specifikacija i
// delom kao kod, ali ekran nije postojao uopšte — zato vlasnik 9.9.2026 nije mogao da nađe „gde
// se cene unose uz pomoć AI agenta".

export interface UvozFormState {
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
 * §4.2.6 — uvoz nastaje odmah, ekstrakcija je zaseban korak.
 *
 * Namerno DVA poziva, ne jedan: da su spojeni, neuspeh modela bi značio da uvoz uopšte ne
 * nastane, pa se ne bi videlo ni šta je pokušano ni zašto nije uspelo. Ovako neuspeh ostavlja
 * zapis sa razlogom, a pokušaj se može ponoviti.
 */
export async function createImport(
  _prev: UvozFormState,
  formData: FormData,
): Promise<UvozFormState> {
  let id: string;
  try {
    const uvoz = await apiFetch<{ id: string }>('/contracting/pricelist-imports', {
      method: 'POST',
      body: {
        supplierId: formData.get('supplierId'),
        sourceFormat: 'PASTED_TEXT',
        sourceText: formData.get('sourceText'),
      },
    });
    id = uvoz.id;
  } catch (err) {
    return { error: poruka(err, 'Kreiranje uvoza nije uspelo.'), ok: null };
  }

  // Ekstrakcija sme da padne bez rušenja toka — uvoz već postoji i ekran će prikazati razlog.
  try {
    await apiFetch(`/contracting/pricelist-imports/${id}/extract`, { method: 'POST' });
  } catch {
    // Namerno prazno: `extract` sam upisuje status FAILED sa razlogom, koji se vidi na ekranu.
  }

  revalidatePath('/cenovnici');
  redirect(`/cenovnici/${id}`);
}

/** §4.2.6 — ponovni pokušaj nad uvozom koji je pao. Vraća ga u PROCESSING pa ponovo poziva model. */
export async function retryExtraction(id: string): Promise<void> {
  try {
    await apiFetch(`/contracting/pricelist-imports/${id}/retry`, { method: 'POST' });
  } catch {
    // Razlog ostaje upisan na samom uvozu; ekran ga prikazuje.
  }
  revalidatePath(`/cenovnici/${id}`);
}

/**
 * §4.2.4 — potvrda reda je jedini korak koji stvarno upisuje cenu (`ContractPeriod` + `RateLine`).
 * Zato je odvojena dozvola (`APPROVE_ROW`) i zato AI ovo nikad ne radi sam.
 */
export async function approveRow(
  importId: string,
  rowId: string,
  matchedProductId: string | undefined,
): Promise<{ error: string | null }> {
  try {
    await apiFetch(`/contracting/pricelist-imports/${importId}/rows/${rowId}/approve`, {
      method: 'POST',
      body: matchedProductId
        ? { decision: 'MANUALLY_MATCHED', matchedProductId }
        : { decision: 'CONFIRMED' },
    });
    revalidatePath(`/cenovnici/${importId}`);
    return { error: null };
  } catch (err) {
    return { error: poruka(err, 'Potvrda reda nije uspela.') };
  }
}

export async function rejectRow(importId: string, rowId: string): Promise<void> {
  try {
    await apiFetch(`/contracting/pricelist-imports/${importId}/rows/${rowId}/reject`, {
      method: 'POST',
    });
  } catch {
    // Odbijanje reda ne sme da obori ekran; red ostaje PENDING i može se pokušati ponovo.
  }
  revalidatePath(`/cenovnici/${importId}`);
}
