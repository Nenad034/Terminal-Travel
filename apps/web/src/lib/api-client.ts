import 'server-only';
import { getSession } from './session';

// M8 spec §1 dopuna (BFF arhitektura) — jedino mesto koje zna adresu apps/api.
// Next.js server poziva NestJS server-to-server; browser nikad ne vidi ovaj URL
// niti sam JWT (ostaje u httpOnly kolačiću, vidi session.ts).
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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Prilaže Authorization header iz sesije ako postoji. Podrazumevano true. */
  auth?: boolean;
  /** Podrazumevano zahteva prijavljenog gosta — baca ako sesija ne postoji. */
  requireAuth?: boolean;
  /** Dodatna zaglavlja (npr. potpis webhook poziva, M10 spec §7.2). */
  headers?: Record<string, string>;
}

/**
 * Server-only helper za pozive ka apps/api. Ne pokušava tiho da osveži istekao
 * access token unutar Server Component čitanja (Next.js ne dozvoljava pisanje
 * kolačića iz tog konteksta) — osvežavanje se dešava eksplicitno u Server Action-ima
 * (npr. login/register/refresh route handleri), gde je pisanje kolačića dozvoljeno.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, requireAuth = false } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };

  if (auth) {
    const session = await getSession();
    if (session) {
      headers['Authorization'] = `Bearer ${session.accessToken}`;
    } else if (requireAuth) {
      throw new ApiError(401, { message: 'Nema aktivne sesije' });
    }
  }

  // BAG (1.9.2026, isti nalaz kao apps/panel/src/lib/api-client.ts, vidi komentar tamo) — fetch
  // baca TypeError (npr. ECONNREFUSED) kad apps/api nije trenutno dostupan; hvatanje ovde
  // pretvara to u ApiError(503) koju svaki pozivalac (login route i sl.) već ume da obradi,
  // umesto da neuhvaćena greška izađe iz route handler-a kao 500 sa praznim telom.
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(503, { message: 'Servis trenutno nedostupan, pokušajte ponovo.' });
  }

  if (!res.ok) {
    let parsedBody: unknown = null;
    try {
      parsedBody = await res.json();
    } catch {
      // odgovor bez tela (npr. 204) — ignoriši
    }
    throw new ApiError(res.status, parsedBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
