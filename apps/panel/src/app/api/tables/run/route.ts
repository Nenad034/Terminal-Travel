import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe } from '@/lib/me';

// BFF za Terminal tabelu (M17 §6e, M15 §6.5.4.10 `POST /ai-orchestration/tables/run`).
// Dozvola po izvoru se proverava na API-ju (zavisi od `spec.source`), ovde samo prijava.
export async function POST(req: NextRequest) {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });
  const body = await req.json();
  try {
    const result = await apiFetch('/ai-orchestration/tables/run', {
      method: 'POST',
      body,
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Tabela nije dostupna' }, {
        status: err.status,
      });
    }
    throw err;
  }
}
