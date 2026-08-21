import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §9, GET /ai-orchestration/inbox. Isti posrednik obrazac kao
// apps/panel/src/app/api/module-activation/[code]/route.ts — gornja traka (dizajn dok. §5c,
// "Ikonica Inbox sa brojem, stalno vidljiva na kraju gornje trake") poziva ovu rutu da izbegne
// direktan pristup apps/api iz klijentske komponente (TopBar.tsx).
export async function GET(_req: NextRequest) {
  try {
    const result = await apiFetch('/ai-orchestration/inbox', { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Agent Inbox nije dostupan' }, { status: err.status });
    }
    throw err;
  }
}
