import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

// M19 spec §3/§8 (WS namespace /ws/chat) — panel čuva M1 access/refresh token isključivo
// server-side, u httpOnly kolačiću (apps/panel/src/lib/session.ts), i browser JS ga nikad ne vidi
// (isti princip kao svaki drugi panel poziv, koji uvek ide kroz apiFetch na serveru). ChatPanel.tsx
// je namerno klijentska komponenta (mora da drži živu socket.io konekciju), a
// ChatGatewayService.extractToken (apps/api/src/modules/m19-komunikaciona-platforma/chat-gateway/
// chat-gateway.service.ts) očekuje TAČNO isti M1 access token u WS handshake `auth.token` —
// jwt.verify istim tajnim ključem kao HTTP JwtAuthGuard. Backend prvog prolaza (avgust 2026) nema
// poseban, uže obimljen "WS ticket" mehanizam — dodavanje takvog mehanizma je izmena M19 backend-a
// van obima ovog panel prolaza (M17 Faza 7).
//
// Zato: ova Route Handler ruta je JEDINO mesto koje sme da vrati taj token klijentskoj strani.
// Bezbednosni argument da je ovo "dovoljno bezbedno za prvi prolaz":
//   - ruta se izvršava server-side (ima pristup httpOnly kolačiću, sam token nikad ne prolazi
//     kroz middleware/logove čitljive klijentu),
//   - zahteva već postojeću validnu panel sesiju (ista provera kao svaki drugi apiFetch poziv),
//   - poziva se sa istog origin-a (same-origin fetch iz ChatPanel.tsx, ne otvoren CORS ka trećim
//     stranama),
//   - klijent token drži isključivo u React state-u (nikad localStorage/kolačić) i traži ga
//     ponovo pre svakog otvaranja socket konekcije — isti kratkoročni život kao sam access token
//     (M1 spec §3.7).
// Ako obim komunikacije to zatraži, sledeći korak je poseban, kraći WS-ticket endpoint u M19
// backend-u (npr. jednokratan token vezan za conversationId) — beleženo kao mogući sledeći korak,
// ne kao propust ovog prolaza.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: 'Nema aktivne sesije' }, { status: 401 });
  }
  return NextResponse.json({ token: session.accessToken });
}
