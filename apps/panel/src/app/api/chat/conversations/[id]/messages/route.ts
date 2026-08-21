import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M19 spec §8, GET /chat/conversations/:id/messages. Isti posrednik obrazac kao
// apps/panel/src/app/api/chat/conversations/route.ts — dizajn dok. §5d "Zvono za obaveštenja"
// (NotificationBell.tsx) povlači istoriju "Obaveštenja" razgovora, ne samo trenutno prikazane
// iskačuće kartice (§5e).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await apiFetch(`/chat/conversations/${id}/messages`, { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Poruke nisu dostupne' }, { status: err.status });
    }
    throw err;
  }
}
