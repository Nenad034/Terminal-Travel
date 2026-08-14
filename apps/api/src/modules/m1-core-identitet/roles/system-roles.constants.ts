// M1 spec §4 — sedam sistemskih uloga (polazni šabloni), plus SUBAGENT_ADMIN/VODIC/
// DOBAVLJAC_KONTAKT dodate pri specifikaciji M7/M9/M19. Ovaj fajl je jedini izvor
// naziva uloga u kodu — seed skripta i MFA provera oslanjaju se na iste konstante.
export const SYSTEM_ROLES = {
  VLASNIK: 'VLASNIK',
  DIREKTOR: 'DIREKTOR',
  HR: 'HR',
  SALES_MANAGER: 'SALES_MANAGER',
  PRODAJNI_AGENT: 'PRODAJNI_AGENT',
  RACUNOVODJA: 'RACUNOVODJA',
  GOST: 'GOST',
  // M7 spec §8 (avgust 2026) — portal nalog subagenta (bilo kog nivoa u hijerarhiji). Nema
  // pristup internom panelu (M17) niti podacima drugih subagenata.
  SUBAGENT_ADMIN: 'SUBAGENT_ADMIN',
  // M9 spec §4 (avgust 2026) — vodič na terenu. Pristup isključivo sopstvenom dodeljenom
  // itineraru i gostima na tim polascima (M5 BookingItem.assigned_guide_id), bez pristupa
  // internom panelu (M17) ili tuđim rezervacijama.
  VODIC: 'VODIC',
} as const;

// M1 spec §5 — "2FA... obavezna za sve interne uloge... ne može se ugasiti od strane
// samog korisnika. Za Gosta opciona." Gost je namerno izostavljen iz ovog spiska.
// SUBAGENT_ADMIN je takođe izostavljen (spoljni B2B portal nalog, ne interni tim). VODIC
// JESTE interni tim (zaposleni vodič) — MFA se proverava pri prijavi (kad ima signala),
// offline-first sinhronizacija (M9 spec §3.2) ne zahteva ponovnu MFA proveru po zapisu.
export const ROLES_REQUIRING_MANDATORY_MFA: string[] = [
  SYSTEM_ROLES.VLASNIK,
  SYSTEM_ROLES.DIREKTOR,
  SYSTEM_ROLES.HR,
  SYSTEM_ROLES.SALES_MANAGER,
  SYSTEM_ROLES.PRODAJNI_AGENT,
  SYSTEM_ROLES.RACUNOVODJA,
  SYSTEM_ROLES.VODIC,
];
