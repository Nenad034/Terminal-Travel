import { NextResponse } from 'next/server';
import { getMe } from '@/lib/me';
import { visibleNavItems } from '@/lib/nav-visible';

// Dizajn dok. §6c.0a (dopuna 25.8.2026, na zahtev vlasnika: "otvore svi moduli u popup meniju...
// odabrati jedan od modula") — AI chat (dokovan ILI Fokus tab) treba ISTU, ulogom filtriranu
// listu modula koju već koriste Shell.tsx/Sidebar.tsx/CommandPalette.tsx (`visibleNavItems`),
// bez izmišljanja druge liste. AiChatBox nema pristup server-side `getMe()`/(app)/layout.tsx
// props-ima kad je u Fokus tabu (posebna ruta, van Shell-ovog stabla) — ova tanka ruta ponovo
// koristi ISTI server-side helper umesto da se lista prosleđuje kroz props (radi identično u
// oba slučaja, docked i Fokus).
export async function GET() {
  const me = await getMe();
  if (!me) return NextResponse.json({ message: 'Nije prijavljen' }, { status: 401 });
  return NextResponse.json(visibleNavItems(me));
}
