import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M19 spec §8, GET /chat/conversations. Isti posrednik obrazac kao module-activation/[code]
// rute — NotificationStack.tsx (dizajn dok. §5e) treba conversationId "Obaveštenja" razgovora
// pre nego što otvori WS konekciju, a to je server-only apiFetch poziv (httpOnly sesija).
export async function GET() {
  try {
    const result = await apiFetch('/chat/conversations', { requireAuth: true });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Razgovori nisu dostupni' }, { status: err.status });
    }
    throw err;
  }
}
