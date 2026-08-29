import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M1 spec §6, GET /iam/audit-log. Isti posrednik obrazac kao
// apps/panel/src/app/api/ops/process-maps/[key]/live/route.ts — desni panel
// (RightPanel.tsx, ProcessMapNodeSummaryCard) poziva ovu rutu da prikaže nekoliko poslednjih
// zapisa uz sažetak čvora, bez direktnog pristupa apps/api iz klijentske komponente.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  try {
    const result = await apiFetch(`/iam/audit-log${qs}`, { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Audit log nije dostupan' }, { status: err.status });
    }
    throw err;
  }
}
