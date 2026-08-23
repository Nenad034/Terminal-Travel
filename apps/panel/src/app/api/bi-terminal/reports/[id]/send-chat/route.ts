import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §6.9.3 dopuna — "predloži pa čovek odobri": ovaj poziv postoji SAMO da prosledi
// eksplicitan klik korisnika (dugme u TerminalPanel.tsx), isti BFF obrazac kao ostale rute.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dto = await req.json();
  try {
    const result = await apiFetch(`/ai-orchestration/bi-terminal/reports/${id}/send-chat`, {
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
