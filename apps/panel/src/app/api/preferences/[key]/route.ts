import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// Vidi apps/panel/src/app/api/preferences/route.ts (GET svih) — ovo upisuje JEDNU vrednost
// pod dati ključ (M1 spec §3.9, `PUT /iam/users/me/preferences/:key`).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = await req.json();
  try {
    const result = await apiFetch(`/iam/users/me/preferences/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: { value: body.value },
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Čuvanje nije uspelo' }, { status: err.status });
    }
    throw err;
  }
}
