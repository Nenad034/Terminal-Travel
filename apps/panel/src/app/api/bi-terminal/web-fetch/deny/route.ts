import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §6.9.7 — LJUDSKI pokrenut klik "Odbij" — samo trag u audit logu, ništa se ne preuzima.
export async function POST(req: NextRequest) {
  const dto = await req.json();
  try {
    const result = await apiFetch('/ai-orchestration/bi-terminal/web-fetch/deny', {
      method: 'POST',
      body: { url: dto.url, reason: dto.reason, originalQuestion: dto.originalQuestion },
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Odbijanje nije uspelo' }, { status: err.status });
    }
    throw err;
  }
}
