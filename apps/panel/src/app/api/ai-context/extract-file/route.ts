import { NextRequest, NextResponse } from 'next/server';
import { apiFetchMultipart, ApiError } from '@/lib/api-client';

// M15 spec §6.5.4.3 dopuna v1.43 (25.8.2026, na zahtev vlasnika — prilog fajla preko "+" u AI
// chat-u) — most posrednik ka POST /ai-orchestration/omnisearch/extract-file, isti obrazac kao
// apps/panel/src/app/api/omnisearch/route.ts. Fajl prolazi kroz ovu rutu NEPROMENJEN (FormData
// se samo prosleđuje dalje), ne piše se na disk ni ovde ni na backend-u (memoryStorage).
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  try {
    const result = await apiFetchMultipart('/ai-orchestration/omnisearch/extract-file', formData);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Izvlačenje sadržaja fajla nije uspelo' }, { status: err.status });
    }
    throw err;
  }
}
