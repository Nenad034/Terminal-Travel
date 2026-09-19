import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getMe } from '@/lib/me';

// BFF — registar izvora Terminal tabele za ekran „Nova tabela" (M17 §6e.2).
export async function GET() {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });
  try {
    const result = await apiFetch('/ai-orchestration/tables/sources', { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Registar nije dostupan' }, {
        status: err.status,
      });
    }
    throw err;
  }
}
