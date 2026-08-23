import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §6.9/§9 — most posrednik ka POST /ai-orchestration/bi-terminal/query, isti obrazac
// kao apps/panel/src/app/api/omnisearch/route.ts. `M15/bi-terminal/VIEW` (isključivo VLASNIK)
// se sprovodi na backend-u — ova ruta samo prosleđuje Bearer token iz sesije.
export async function POST(req: NextRequest) {
  const dto = await req.json();
  try {
    const result = await apiFetch('/ai-orchestration/bi-terminal/query', {
      method: 'POST',
      body: { query: dto.query },
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Upit nije uspeo' }, { status: err.status });
    }
    throw err;
  }
}
