import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M18 spec §9a, GET /ops/process-maps/:key/live. Isti posrednik obrazac kao
// apps/panel/src/app/api/ai-orchestration/inbox/route.ts — klijentska komponenta
// (ProcessMapView.tsx) poll-uje ovu rutu na 5 sekundi, izbegava direktan pristup apps/api.
export async function GET(req: NextRequest, props: { params: Promise<{ key: string }> }) {
  const params = await props.params;
  const windowMinutes = req.nextUrl.searchParams.get('windowMinutes');
  const qs = windowMinutes ? `?windowMinutes=${encodeURIComponent(windowMinutes)}` : '';
  try {
    const result = await apiFetch(`/ops/process-maps/${params.key}/live${qs}`, { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Procesna mapa nije dostupna' }, { status: err.status });
    }
    throw err;
  }
}
