import Constants from 'expo-constants';
import { clearSession, getSession, setSession } from './session';

// M9 v1.4 — isti obrazac kao apps/panel/src/lib/api-client.ts, ali klijent zove
// apps/api DIREKTNO (nema Next.js BFF sloj na mobilnom uređaju): token se čita iz
// expo-secure-store (session.ts), a ne iz httpOnly kolačića.
const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:3000/api/v1';

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
}

async function doFetch(path: string, method: string, body: unknown, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function tryRefresh(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    const res = await doFetch('/iam/auth/refresh', 'POST', { refreshToken: session.refreshToken }, null);
    if (!res.ok) {
      await clearSession();
      return null;
    }
    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    await setSession({ ...session, accessToken: body.accessToken, refreshToken: body.refreshToken });
    return body.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  let accessToken: string | null = null;
  if (auth) {
    const session = await getSession();
    accessToken = session?.accessToken ?? null;
  }

  let res = await doFetch(path, method, body, accessToken);

  // Access token ima kratak vek (M1 spec §3.7) — jedan tihi pokušaj refresh-a pre nego
  // što se greška prijavi pozivaocu, isti obrazac kao apps/panel (tamo ga radi middleware,
  // ovde nema middleware sloja pa je ugrađeno direktno u klijent).
  if (res.status === 401 && auth && accessToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(path, method, body, refreshed);
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
