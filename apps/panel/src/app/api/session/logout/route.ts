import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getSession, clearSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  if (session) {
    try {
      await apiFetch('/iam/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken }, auth: false });
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      // token je već nevažeći na serveru — svejedno brišemo lokalni kolačić ispod
    }
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
