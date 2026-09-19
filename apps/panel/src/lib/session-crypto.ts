import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Šifrovanje sesijskog kolačića — izdvojeno iz `session.ts` (19.9.2026) da bi ga i `src/proxy.ts`
// mogao uvesti: proxy ne sme da uvozi `next/headers` (`cookies()` tu ne postoji), a ovde ga nema.
// `session.ts` i dalje ostaje jedino mesto koje čita/piše kolačić kroz `next/headers`.

export const COOKIE_NAME = 'tt_panel_session';
const ALGO = 'aes-256-gcm';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  /**
   * Dizajn dok. §6i / M17 §3.0 (17.9.2026) — „Zapamti me na ovom uređaju". `true` → kolačić
   * traje 7 dana (M1 §3.7 refresh token); `false` → sesijski kolačić, gasi se zatvaranjem
   * pregledača. Pamti se u samom kolačiću da ga osvežavanje tokena ne pregazi. Nedefinisano
   * (kolačići od pre ove dopune) = `true` — niko se ne odjavljuje zbog dopune.
   */
  remember?: boolean;
}

function encryptionKey(): Buffer {
  const secret = process.env.PANEL_SESSION_SECRET;
  if (!secret) throw new Error('PANEL_SESSION_SECRET nije podešen (.env.local)');
  return scryptSync(secret, 'tt-panel-session', 32);
}

/** Izvezeno za `src/proxy.ts` (osvežavanje tokena pre isteka) — jedino drugo mesto koje piše kolačić. */
export function encrypt(data: SessionData): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function decrypt(raw: string): SessionData | null {
  try {
    const buf = Buffer.from(raw, 'base64url');
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const encrypted = buf.subarray(28);
    const decipher = createDecipheriv(ALGO, encryptionKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

/** Atributi kolačića — isti u Route Handler-u (`session.ts#setSession`) i u `src/proxy.ts`. */
export function sessionCookieOptions(data: SessionData) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    // M1 spec §3.7 — refresh token traje 7 dana; kolačić prati taj rok, ne access token TTL.
    // Bez „Zapamti me" (dizajn dok. §6i) kolačić nema `maxAge` = sesijski, do zatvaranja pregledača.
    ...(data.remember === false ? {} : { maxAge: 7 * 24 * 60 * 60 }),
  };
}
