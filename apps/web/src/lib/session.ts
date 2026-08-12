import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { cookies } from 'next/headers';

// M8 spec §1 dopuna (BFF arhitektura) — M1 access/refresh token nikad izlaze u
// browser. Čuvaju se ovde, u httpOnly kolačiću, simetrično šifrovani (AES-256-GCM)
// ključem izvedenim iz WEB_SESSION_SECRET (odvojen od apps/api JWT_SECRET — različiti
// procesi, različita tajna). Samo ovaj fajl sme da čita/piše kolačić.

const COOKIE_NAME = 'tt_session';
const ALGO = 'aes-256-gcm';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

function encryptionKey(): Buffer {
  const secret = process.env.WEB_SESSION_SECRET;
  if (!secret) throw new Error('WEB_SESSION_SECRET nije podešen (.env.local)');
  return scryptSync(secret, 'tt-web-session', 32);
}

function encrypt(data: SessionData): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

function decrypt(raw: string): SessionData | null {
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

/** Čitljivo u Server Component-ima i Route Handler-ima (read-only kontekst je OK). */
export async function getSession(): Promise<SessionData | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decrypt(raw);
}

/** Sme da se pozove SAMO iz Server Action-a ili Route Handler-a (Next.js ograničenje pisanja kolačića). */
export async function setSession(data: SessionData): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encrypt(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // M1 spec §3.7 — refresh token traje 7 dana; kolačić prati taj rok, ne access token TTL.
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
