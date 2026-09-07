import { cache } from 'react';
import { apiFetch } from './api-client';

export interface AgencySettings {
  brandName: string;
  legalName: string | null;
  address: string | null;
  taxId: string | null;
  licenseNumber: string | null;
  emergencyContact: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

// M1 spec §3.9c. Isti razlog i ista rezervna vrednost kao u `apps/web/src/lib/agency.ts` —
// zaglavlje panela ne sme da ostane prazno ako API zakasni.
const REZERVA: AgencySettings = {
  brandName: 'Terminal Travel',
  legalName: null,
  address: null,
  taxId: null,
  licenseNumber: null,
  emergencyContact: null,
  email: null,
  phone: null,
  website: null,
};

// Pun zapis — traži prijavu. Koristi ga ekran Podešavanja → Podaci agencije.
export const getAgency = cache(async (): Promise<AgencySettings> => {
  try {
    return await apiFetch<AgencySettings>('/iam/agency-settings');
  } catch {
    return REZERVA;
  }
});

// Samo naziv, sa JAVNOG endpointa. Namerno odvojeno: koreni layout se iscrtava i na stranici za
// prijavu, gde sesija još ne postoji — kad bi naslov išao preko zapisa koji traži token, svaka
// poseta stranici za prijavu proizvela bi jedan neuspeo poziv ka API-ju.
export const getAgencyBrand = cache(async (): Promise<string> => {
  try {
    const { brandName } = await apiFetch<{ brandName: string }>('/iam/public/agency');
    return brandName;
  } catch {
    return REZERVA.brandName;
  }
});
