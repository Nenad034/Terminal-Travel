'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
}

// M2 spec §7 — POST /catalog/products: uvek kreira CONTRACTED proizvod (ručni unos, M17
// spec §7 Faza 1 izlazni kriterijum: "tim može ručno da unese proizvod").
export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const product = await apiFetch<{ id: string }>('/catalog/products', {
      method: 'POST',
      body: {
        type: formData.get('type'),
        destinationCountry: formData.get('destinationCountry'),
        destinationCity: formData.get('destinationCity'),
      },
    });
    // Odmah upisujemo srpski naziv/opis (obavezan prevod da proizvod ima ijedan naziv).
    await apiFetch(`/catalog/products/${product.id}/translations`, {
      method: 'PUT',
      body: {
        languageCode: 'sr',
        name: formData.get('name'),
        description: formData.get('description') || '(bez opisa)',
        slug: String(formData.get('name') ?? '')
          .toLowerCase()
          .replace(/[^a-z0-9čćžšđ ]/gi, '')
          .trim()
          .replace(/\s+/g, '-'),
      },
    });
    revalidatePath('/katalog');
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Kreiranje proizvoda nije uspelo.' };
  }
  redirect('/katalog');
}

export async function updateProductTranslation(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get('id'));
  try {
    await apiFetch(`/catalog/products/${id}/translations`, {
      method: 'PUT',
      body: {
        languageCode: 'sr',
        name: formData.get('name'),
        description: formData.get('description'),
        slug: formData.get('slug'),
      },
    });
    revalidatePath(`/katalog/${id}`);
    revalidatePath('/katalog');
  } catch (err) {
    return { error: err instanceof ApiError ? extractMessage(err) : 'Izmena nije uspela.' };
  }
  return { error: null };
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
