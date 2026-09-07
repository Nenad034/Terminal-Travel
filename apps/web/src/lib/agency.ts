import { cache } from 'react';
import { apiFetch } from './api-client';

export interface AgencyPublic {
  brandName: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
}

// M1 spec §3.9c — naziv agencije više nije zakucan u kodu sajta nego dolazi sa API-ja, da bi
// promena imena (rebrend, ili ustupanje platforme drugoj agenciji) bila izmena jednog polja u
// panelu umesto izmene ~50 mesta u kodu.
//
// REZERVNA VREDNOST je namerna, a ne propust: ako API ne odgovori, naslov stranice i podnožje
// dobijaju poslednje poznato ime umesto praznine. Prazan naslov je gori kvar od zastarelog
// imena — spec §3.9c to izričito dozvoljava prikaznim kanalima.
const REZERVA: AgencyPublic = {
  brandName: 'Terminal Travel',
  email: null,
  phone: null,
  website: null,
  address: null,
};

// `cache` — jedan poziv po zahtevu, koliko god komponenti ga tražilo (podnožje, naslov, JSON-LD).
export const getAgency = cache(async (): Promise<AgencyPublic> => {
  try {
    return await apiFetch<AgencyPublic>('/iam/public/agency');
  } catch {
    return REZERVA;
  }
});
