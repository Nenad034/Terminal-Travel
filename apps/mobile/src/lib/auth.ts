import { apiFetch } from './api-client';
import { clearSession, getSession, setSession } from './session';

// M9 v1.4 — dvokoraka prijava (M1 spec §5/§6), isti tok kao apps/panel LoginForm.tsx:
// korak 1 email+lozinka -> ako nalog ima MFA (uvek za VODIC, opciono za GOST), server vraća
// {requiresMfa, mfaToken}; korak 2 šalje 6-cifreni kod. Posle uspeha se poziva GET
// /iam/auth/me (jedini izvor uloge — M1 spec §3.7, token nosi samo user_id/session_id).

interface LoginResponse {
  requiresMfa?: boolean;
  mfaToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

interface MeResponse {
  userId: string;
  roles: string[];
}

export async function login(email: string, password: string): Promise<{ requiresMfa: true; mfaToken: string } | { requiresMfa: false }> {
  const res = await apiFetch<LoginResponse>('/iam/auth/login', { method: 'POST', body: { email, password } });
  if (res.requiresMfa) {
    return { requiresMfa: true, mfaToken: res.mfaToken! };
  }
  await finalizeSession(res.accessToken!, res.refreshToken!);
  return { requiresMfa: false };
}

export async function verifyMfa(mfaToken: string, code: string): Promise<void> {
  const res = await apiFetch<{ accessToken: string; refreshToken: string }>('/iam/auth/mfa/verify', {
    method: 'POST',
    body: { mfaToken, code },
  });
  await finalizeSession(res.accessToken, res.refreshToken);
}

async function finalizeSession(accessToken: string, refreshToken: string): Promise<void> {
  // Privremena sesija bez role da bi apiFetch('/iam/auth/me') imao token za slanje.
  await setSession({ accessToken, refreshToken, userId: '', role: 'GOST' });
  const me = await apiFetch<MeResponse>('/iam/auth/me');
  const role = me.roles.includes('VODIC') ? 'VODIC' : 'GOST';
  await setSession({ accessToken, refreshToken, userId: me.userId, role });
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await apiFetch('/iam/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } });
    } catch {
      // I dalje briši lokalnu sesiju i ako server poziv ne uspe (npr. bez signala) —
      // korisnik očekuje da je odjavljen na uređaju odmah.
    }
  }
  await clearSession();
}
