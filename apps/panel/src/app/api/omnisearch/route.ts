import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §6.5.4, §9; M17 spec §5.5 — most posrednik ka POST /ai-orchestration/omnisearch,
// isti obrazac kao apps/panel/src/app/api/session/*. CommandPalette.tsx (klijentska komponenta)
// ne zna adresu apps/api — poziva ovu rutu, ova ruta nosi Bearer token iz sesije (apiFetch, auth
// podrazumevano true).
export async function POST(req: NextRequest) {
  const dto = await req.json();

  try {
    const result = await apiFetch('/ai-orchestration/omnisearch', {
      method: 'POST',
      body: { query: dto.query, channel: 'INTERNAL_PANEL', pageContent: dto.pageContent, contextItems: dto.contextItems, history: dto.history },
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Pretraga nije uspela' }, { status: err.status });
    }
    throw err;
  }
}
