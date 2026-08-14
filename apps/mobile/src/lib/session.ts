import * as SecureStore from 'expo-secure-store';

// M9 spec §7 v1.4 dopuna (plan implementacije mobilnog klijenta) — isti obrazac kao
// apps/panel/src/lib/session.ts i apps/web/src/lib/session.ts (M1 tokeni se nikad ne
// drže u čistom JS stanju duže nego što mora), ali bez BFF/httpOnly-kolačić dela jer RN
// nema server runtime: tokeni se čuvaju direktno na uređaju preko expo-secure-store
// (iOS Keychain / Android Keystore — enkriptovano od strane OS-a, ne od ove aplikacije).

const STORE_KEY = 'tt_mobile_session';

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  /** Naziv uloge dekodovan iz JWT-a (npr. VODIC ili GOST) — određuje koji stek ekrana se prikazuje. */
  role: string;
}

export async function getSession(): Promise<SessionData | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function setSession(data: SessionData): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(data));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}
