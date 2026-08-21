import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M19 spec §8, POST /chat/conversations/:id/read. Isti posrednik obrazac kao
// apps/panel/src/app/api/chat/conversations/route.ts — poziva ga NotificationBell.tsx
// (dizajn dok. §5d) pri otvaranju gomile, odvojeno od `markConversationRead` server akcije
// koja postoji samo unutar (app)/chat rute (ova komponenta je montirana globalno u Shell.tsx).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await apiFetch(`/chat/conversations/${id}/read`, { method: 'POST', requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Označavanje pročitanim nije uspelo' }, { status: err.status });
    }
    throw err;
  }
}
