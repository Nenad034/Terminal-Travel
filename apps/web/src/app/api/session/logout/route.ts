import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api-client';
import { clearSession, getSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  if (session) {
    // Best-effort — i ako opoziv na backend-u ne uspe, kolačić se ipak briše lokalno.
    await apiFetch('/iam/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken }, auth: false }).catch(() => {});
  }
  await clearSession();
  return NextResponse.json({ ok: true });
}
