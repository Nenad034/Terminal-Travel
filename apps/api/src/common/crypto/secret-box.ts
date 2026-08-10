import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM enkripcija za polja koja spec traži "enkriptovano u mirovanju"
 * (npr. User.mfaSecretEncrypted, M1 spec §3.1). Ključ dolazi iz ENCRYPTION_KEY
 * (env), nikad u kodu — Master dokument poglavlje 9 (bezbednosni baseline).
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY nije podešen (.env) — obavezan za enkripciju MFA sekreta u mirovanju.');
  }
  // Dozvoljava proizvoljnu dužinu ulaznog stringa — svodi na tačno 32 bajta (AES-256).
  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split('.');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}

/** Za RefreshToken/PasswordResetToken/MfaRecoveryCode — "čuva se heš, ne sirov token" (§3.7). */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}
