import { NextRequest, NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  decrypt,
  encrypt,
  sessionCookieOptions,
  type SessionData,
} from '@/lib/session-crypto';

// Osvežavanje M1 tokena PRE isteka, na jednom mestu koje SME da upiše kolačić (zamka 9.14,
// 19.9.2026, otkriveno na Terminal tabeli kao „Nije prijavljen" posle ~15 min rada).
//
// Uzrok: access token traje 15 min (M1 §3.7), refresh token ROTIRA pri svakom korišćenju —
// stari se odmah opoziva. Kad Server Component (`page.tsx`/`layout.tsx`) naiđe na 401,
// `api-client.ts` osveži token, ali Server Component NE MOŽE da upiše kolačić (Next.js
// ograničenje) — pregledač zadrži STARI, već opozvani refresh token, pa svako sledeće
// osvežavanje pada i korisnik je „odjavljen" iako je kolačić tu. Route Handler-i tu grešku ne
// prave (smeju da pišu kolačić), ali prva navigacija posle isteka uvek ide kroz Server Component.
//
// Rešenje: proxy (Next 16 naziv za middleware) na SVAKOM zahtevu pogleda `exp` iz access
// tokena; ako ističe za manje od `REFRESH_BEFORE_MS`, osveži ga OVDE, upiše nov kolačić u
// odgovor i prepravi `Cookie` zaglavlje zahteva da ga i Server Component u istom zahtevu vidi.
// Grana za osvežavanje u `api-client.ts` ostaje kao rezerva (npr. token istekao dok je server
// bio ugašen), ali u redovnom radu više ne dolazi na red.
//
// Paralelni zahtevi sa istim tokenom (StatusBar polling + navigacija) dele jedno osvežavanje
// (`inFlight`, po refresh tokenu) — inače bi drugi pokušaj rotirao već opozvan token i pao.

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1';
const REFRESH_BEFORE_MS = 2 * 60 * 1000;

const inFlight = new Map<string, Promise<SessionData | null>>();

function accessTokenExpiresAt(accessToken: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function refresh(session: SessionData): Promise<SessionData | null> {
  const existing = inFlight.get(session.refreshToken);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/iam/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const { accessToken, refreshToken } = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      return { ...session, accessToken, refreshToken };
    } catch {
      return null;
    }
  })().finally(() => inFlight.delete(session.refreshToken));
  inFlight.set(session.refreshToken, promise);
  return promise;
}

export async function proxy(req: NextRequest) {
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return NextResponse.next();
  const session = decrypt(raw);
  if (!session) return NextResponse.next();

  const exp = accessTokenExpiresAt(session.accessToken);
  if (exp === null || exp - Date.now() > REFRESH_BEFORE_MS) return NextResponse.next();

  const next = await refresh(session);
  // Neuspeh (refresh istekao/opozvan, API nedostupan) — pusti zahtev dalje neizmenjen;
  // `(app)/layout.tsx` će na 401 preusmeriti na prijavu. Kolačić se ovde ne briše.
  if (!next) return NextResponse.next();

  const encrypted = encrypt(next);
  // Zahtev koji ide dalje (Server Component / Route Handler) mora da vidi NOV kolačić —
  // `req.cookies.set` prepravlja `Cookie` zaglavlje zahteva.
  req.cookies.set(COOKIE_NAME, encrypted);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(COOKIE_NAME, encrypted, sessionCookieOptions(next));
  return res;
}

export const config = {
  // Sve osim statičkih fajlova — i stranice i `/api/*` (BFF rute takođe koriste sesiju).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico|woff2?)$).*)'],
};
