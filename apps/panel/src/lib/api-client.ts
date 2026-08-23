import 'server-only';
import { getSession, setSession, type SessionData } from './session';

// M17 zadatak (avgust 2026) — jedino mesto koje zna adresu apps/api, isti obrazac kao
// apps/web/src/lib/api-client.ts (M8 spec §1 dopuna). M17 nema sopstvenu bazu/poslovnu
// logiku (M17 spec §2) — sav podatak dolazi odavde, direktno sa zvaničnih API-ja modula.
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API greška ${status}`);
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Prilaže Authorization header iz sesije ako postoji. Podrazumevano true. */
  auth?: boolean;
  /** Podrazumevano zahteva prijavljenog korisnika — baca ako sesija ne postoji. */
  requireAuth?: boolean;
  /** Prosleđuje se fetch-u — 'no-store' podrazumevano (panel prikazuje uvek sveže podatke). */
  cache?: RequestCache;
}

// BAG (23.8.2026, prijavio vlasnik uživo — AI chat je tiho pokazivao "AI pretraga još nije
// uključena" iako je M15_OMNISEARCH bio stvarno ACTIVATED) — pravi uzrok nije bio aktivacija,
// nego istekao access token (M1 spec §3.7, TTL 15 min) bez ikakvog osvežavanja: sesija čuva
// `refreshToken` (kolačić traje 7 dana, isti rok kao refresh token) ali ga ništa nije koristilo
// — `POST /iam/auth/refresh` postoji i implementiran je na backend-u (M1 spec poglavlje 6) otkad
// je modul napravljen, samo nikad ožičen ovde. Posledica: svaki zahtev posle 15 minuta je tiho
// dobijao 401, `AiChatBox.tsx` ne proverava `res.ok`, pa se svaki auth-neuspeh renderovao
// identično kao "omnisearch nije aktivan" — dva različita uzroka, ista zbunjujuća poruka.
// Rešenje ovde: na 401, pokušaj TAČNO JEDNOM osvežavanje pre nego što se odustane (sprečava
// beskonačnu petlju). `setSession` je dozvoljen samo iz Server Action/Route Handler konteksta
// (Next.js ograničenje) — `apiFetch` se poziva i iz Server Component render-a (read-only), zato
// je upis nove sesije u `try/catch`: ako ne uspe da se upiše (read-only kontekst), osvežen token
// se ipak koristi za OVAJ zahtev, sledeći zahtev će ponovo osvežiti (blago rasipno, ne pogrešno).
async function refreshSession(refreshToken: string): Promise<SessionData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/iam/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const { accessToken, refreshToken: newRefreshToken } = (await res.json()) as { accessToken: string; refreshToken: string };
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
    const next: SessionData = { accessToken, refreshToken: newRefreshToken, userId: payload.sub };
    try {
      await setSession(next);
    } catch {
      // Server Component (read-only) kontekst — ne može da upiše kolačić, koristi osvežen token
      // samo za tekući zahtev, ne prekida tok.
    }
    return next;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, requireAuth = false, cache = 'no-store' } = options;

  let session = auth ? await getSession() : null;
  if (auth && !session && requireAuth) {
    throw new ApiError(401, { message: 'Nema aktivne sesije' });
  }

  async function doFetch(accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
    });
  }

  let res = await doFetch(session?.accessToken ?? null);

  if (res.status === 401 && session) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) {
      session = refreshed;
      res = await doFetch(session.accessToken);
    }
  }

  if (!res.ok) {
    let parsedBody: unknown = null;
    try {
      parsedBody = await res.json();
    } catch {
      // odgovor bez tela — ignoriši
    }
    throw new ApiError(res.status, parsedBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// M19 spec §2.5/§8 (v1.6, 22.8.2026) — varijanta `apiFetch`-a za `multipart/form-data` (prilog
// fajla), koju obična JSON putanja iznad ne pokriva. Namerno bez `Content-Type` zaglavlja — fetch
// ga sam postavlja uz ispravan `boundary` kad je telo `FormData`; ručno postavljanje bi ga
// pokvarilo.
export async function apiFetchMultipart<T>(path: string, formData: FormData): Promise<T> {
  let session = await getSession();

  async function doFetch(accessToken: string | null): Promise<Response> {
    const headers: Record<string, string> = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData, cache: 'no-store' });
  }

  let res = await doFetch(session?.accessToken ?? null);

  // Isti istekao-token popravak kao apiFetch iznad — vidi komentar tamo.
  if (res.status === 401 && session) {
    const refreshed = await refreshSession(session.refreshToken);
    if (refreshed) {
      session = refreshed;
      res = await doFetch(session.accessToken);
    }
  }

  if (!res.ok) {
    let parsedBody: unknown = null;
    try {
      parsedBody = await res.json();
    } catch {
      // odgovor bez tela — ignoriši
    }
    throw new ApiError(res.status, parsedBody);
  }
  return res.json() as Promise<T>;
}
