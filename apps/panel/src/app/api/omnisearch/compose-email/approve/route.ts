import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';

// M15 spec §6.5.4.8 — LJUDSKI pokrenut klik "Odobri" u AiChatBox.tsx, isti tanki BFF obrazac kao
// bi-terminal/web-fetch/approve. Tek posle ovog poziva backend stvarno upisuje nacrt u M22.
export async function POST(req: NextRequest) {
  const dto = await req.json();
  try {
    const result = await apiFetch('/ai-orchestration/omnisearch/compose-email/approve', {
      method: 'POST',
      body: {
        to: dto.to,
        subject: dto.subject,
        body: dto.body,
        mailboxId: dto.mailboxId,
        mailboxAddress: dto.mailboxAddress,
      },
      requireAuth: true,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(err.body ?? { message: 'Odobrenje nije uspelo' }, {
        status: err.status,
      });
    }
    throw err;
  }
}
