'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';

// M23 spec §5 — javni, neautentifikovan link preko share_token (`GET /knowledge/public/:shareToken`,
// M8 ruta `/znanje/:share_token` ostaje van obima ovog prolaza — CLAUDE.md, ne diramo apps/web).
// Ostaje isti link posle svake naredne odobrene revizije (§5) — osoblje ga ručno lepi u kanal po
// izboru (email/Viber/WhatsApp/Telegram/SMS), nema API integracije u v1.
export default function ShareLinkBox({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = useState(false);
  // M8 stranica koja treba da čita ovaj token je van obima ovog prolaza (M23 spec §7/§10) — prikazujemo
  // relativnu putanju koju M8 treba da izloži, ne pretpostavljamo apsolutan domen agencije.
  const path = `/znanje/${shareToken}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API nedostupan (npr. bez HTTPS) — korisnik i dalje može ručno da selektuje tekst.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-panel2 p-3 text-xs">
      <Icon name="link" className="text-accent" />
      <code className="flex-1 truncate text-ink-dim">{path}</code>
      <Button type="button" onClick={copy} variant="outline" size="sm" className="h-auto px-2 py-1">
        {copied ? 'kopirano' : 'kopiraj'}
      </Button>
    </div>
  );
}
