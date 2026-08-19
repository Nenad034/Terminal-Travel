import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §9, GET /ai-orchestration/modules/:code/activation. Isti posrednik obrazac kao
// apps/panel/src/app/api/omnisearch/route.ts — donja traka (dizajn dok. §5d, "AI status po
// trenutnom modulu") poziva ovu rutu umesto direktnog pristupa apps/api. Uspešan odgovor
// ovde služi i kao signal da je API dostupan (§5d, "Status veze") — nema poseban /health
// poziv, ne uvodi se nov endpoint samo za to.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const result = await apiFetch(`/ai-orchestration/modules/${code}/activation`, { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Status agenta nije dostupan' }, { status: err.status });
    }
    throw err;
  }
}
