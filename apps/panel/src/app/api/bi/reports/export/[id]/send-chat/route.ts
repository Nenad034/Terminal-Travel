import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M13 spec §7 v1.5 — isti obrazac kao `bi-terminal/reports/[id]/send-chat/route.ts`, samo ka
// M13-ovoj sopstvenoj ruti (koja ima ISPRAVNU, po `reportKind`-u zavisnu dozvolu, ne
// `M15/bi-terminal/VIEW` — vidi ReportsService.assertCanAccess na API strani).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dto = await req.json();
  try {
    const result = await apiFetch(`/bi/reports/export/${id}/send-chat`, {
      method: 'POST',
      body: { conversationId: dto.conversationId },
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Slanje nije uspelo' }, { status: err.status });
    }
    throw err;
  }
}
