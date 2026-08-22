import 'server-only';
import { getSession } from './session';

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

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, requireAuth = false, cache = 'no-store' } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (auth) {
    const session = await getSession();
    if (session) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    } else if (requireAuth) {
      throw new ApiError(401, { message: 'Nema aktivne sesije' });
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache,
  });

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
  const headers: Record<string, string> = {};
  const session = await getSession();
  if (session) headers['Authorization'] = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers, body: formData, cache: 'no-store' });

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
