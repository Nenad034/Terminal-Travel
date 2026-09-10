'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, apiFetchMultipart, ApiError } from '@/lib/api-client';

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

/**
 * §4.2.7 (v1.36, 10.9.2026) — uvoz FAJLA. Isti tok kao nalepljen tekst: prvo nastane zapis, pa
 * se ekstrakcija poziva zasebno, iz istog razloga (neuspeh modela ostavlja trag umesto da
 * pojede ceo uvoz).
 *
 * Razlika je samo u prvom koraku — `multipart/form-data` umesto JSON-a, jer fajl ide na disk.
 */
export async function uploadImport(
  _prev: UvozFormState,
  formData: FormData,
): Promise<UvozFormState> {
  const fajl = formData.get('file');
  if (!(fajl instanceof File) || fajl.size === 0) {
    return { error: 'Nijedan fajl nije izabran.', ok: null };
  }

  let id: string;
  try {
    const telo = new FormData();
    telo.append('supplierId', String(formData.get('supplierId') ?? ''));
    telo.append('file', fajl);
    const uvoz = await apiFetchMultipart<{ id: string }>(
      '/contracting/pricelist-imports/upload',
      telo,
    );
    id = uvoz.id;
  } catch (err) {
    return { error: poruka(err, 'Učitavanje fajla nije uspelo.'), ok: null };
  }

  try {
    await apiFetch(`/contracting/pricelist-imports/${id}/extract`, { method: 'POST' });
  } catch {
    // Isto kao kod teksta: razlog se upisuje na sam uvoz i vidi se na ekranu.
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
 * §4.2.10 (v1.39) — primena potvrđenih RAZLIKA iz uvoza, za jedan ugovor.
 *
 * Zamenjuje `approveRow`. Klijent šalje samo ključeve razlika koje je čovek potvrdio i datum od
 * kog nova cena važi — cene se grade na serveru iz `PricelistImportRow` zapisa. Da klijent šalje
 * i cene, potvrđeno i primenjeno bi mogli da se raziđu (§2.11l, pravilo 3).
 */
export async function primeniUvoz(
  importId: string,
  contractId: string,
  telo: { effectiveFrom: string; prihvaceniKljucevi: string[] },
): Promise<{ error: string | null }> {
  try {
    await apiFetch(`/contracting/pricelist-imports/${importId}/ugovori/${contractId}/primeni`, {
      method: 'POST',
      body: telo,
    });
    revalidatePath(`/cenovnici/${importId}`);
    revalidatePath('/ugovori');
    return { error: null };
  } catch (err) {
    return { error: poruka(err, 'Primena razlika nije uspela.') };
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
