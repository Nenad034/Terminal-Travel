'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/lib/api-client';

export interface FormState {
  error: string | null;
  ok: boolean;
}

function extractMessage(err: ApiError): string {
  const body = err.body as { message?: string | string[] } | null;
  if (!body?.message) return `Greška (${err.status})`;
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}

// Prazno polje u formi znači "obriši vrednost", pa se šalje null, ne prazan string —
// backend tako razlikuje "nije podešeno" od "podešeno na prazno".
function tekstIliNull(fd: FormData, kljuc: string): string | null {
  const v = fd.get(kljuc);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

// M1 spec §3.9c — PUT /iam/agency-settings. Traži `M1/agency-settings/EDIT` (Vlasnik/Direktor);
// ekran dugme i ne prikazuje bez te dozvole, ali backend je pravi čuvar, ne ekran.
export async function updateAgencySettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const brandName = formData.get('brandName');
  if (typeof brandName !== 'string' || brandName.trim() === '') {
    return {
      error: 'Naziv agencije je obavezan — prikazuje se gostu na svakoj stranici.',
      ok: false,
    };
  }

  try {
    await apiFetch('/iam/agency-settings', {
      method: 'PUT',
      body: {
        brandName: brandName.trim(),
        legalName: tekstIliNull(formData, 'legalName'),
        address: tekstIliNull(formData, 'address'),
        taxId: tekstIliNull(formData, 'taxId'),
        licenseNumber: tekstIliNull(formData, 'licenseNumber'),
        emergencyContact: tekstIliNull(formData, 'emergencyContact'),
        email: tekstIliNull(formData, 'email'),
        phone: tekstIliNull(formData, 'phone'),
        website: tekstIliNull(formData, 'website'),
      },
    });
  } catch (err) {
    return {
      error: err instanceof ApiError ? extractMessage(err) : 'Čuvanje podataka nije uspelo.',
      ok: false,
    };
  }

  // Naziv agencije stoji u zaglavlju panela i podnožju sajta — posle izmene se mora osvežiti
  // sve, ne samo ova stranica.
  revalidatePath('/', 'layout');
  return { error: null, ok: true };
}
