import 'server-only';
import { cookies } from 'next/headers';
import {
  COOKIE_NAME,
  decrypt,
  encrypt,
  sessionCookieOptions,
  type SessionData,
} from './session-crypto';

export { COOKIE_NAME, type SessionData } from './session-crypto';

// M17 zadatak (avgust 2026) — isti BFF/sesijski obrazac kao apps/web/src/lib/session.ts
// (M8 spec §1 dopuna): M1 access/refresh token nikad izlaze u browser, čuvaju se ovde,
// u httpOnly kolačiću, simetrično šifrovani (AES-256-GCM) ključem izvedenim iz
// PANEL_SESSION_SECRET (odvojen i od apps/api JWT_SECRET i od apps/web WEB_SESSION_SECRET —
// tri različita procesa, tri različite tajne). Samo ovaj fajl (i `src/proxy.ts`, koji osvežava
// token pre isteka) sme da čita/piše kolačić; šifrovanje je u `session-crypto.ts` da bi ga oba
// mogla uvesti bez `next/headers` (koji u proxy-ju ne postoji).

/** Čitljivo u Server Component-ima i Route Handler-ima (read-only kontekst je OK). */
export async function getSession(): Promise<SessionData | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decrypt(raw);
}

/** Sme da se pozove SAMO iz Server Action-a ili Route Handler-a (Next.js ograničenje pisanja kolačića). */
export async function setSession(data: SessionData): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encrypt(data), sessionCookieOptions(data));
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
