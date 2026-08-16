// M19 spec §2.4 — mali status-indikator (ONLINE/AWAY/OFFLINE), korišćen i sa servera
// (page.tsx, inicijalni SSR prikaz) i sa klijenta (ChatPanel.tsx, uživo ažuriranje preko WS-a).
// Namerno izdvojen u sopstveni fajl: ChatPanel.tsx je 'use client' i ranije je uvozio ovu
// komponentu direktno iz page.tsx (server komponenta koja uvozi 'server-only' api-client.ts/
// me.ts) — webpack je tu import putanju pratio u klijentski bandl i build je padao
// ("You're importing a component that needs server-only"). Ovaj fajl nema nijedan server-only
// uvoz, pa je bezbedan i za server i za klijent stranu.
export function PresenceDot({ status }: { status: 'ONLINE' | 'AWAY' | 'OFFLINE' | null }) {
  const tone = status === 'ONLINE' ? 'bg-ok' : status === 'AWAY' ? 'bg-warn' : 'bg-ink-faint';
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} title={status ?? 'nepoznato'} />;
}
