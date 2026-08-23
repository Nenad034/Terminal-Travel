'use client';

import { useState } from 'react';
import Icon from './Icon';

// Kopiranje pojedinačne poruke (22.8.2026, na zahtev vlasnika: "omogućite kopiranje svake
// poruke") — dugme se pojavljuje na hover preko cele grupe (`group`/`group-hover`), izbegava
// da svaka poruka trajno nosi vidljivu ikonicu. `navigator.clipboard` zahteva siguran kontekst
// (https/localhost) — panel već radi isključivo tako (dev na localhost, produkcija bez izbora
// hosting provajdera i dalje čeka HTTPS po planu). Izdvojeno iz AiChatBox.tsx (23.8.2026) da
// isti obrazac koristi i TerminalPanel.tsx bez dupliranja.
export default function CopyButton({
  text,
  className = '',
  alwaysVisible = false,
  title = 'Kopiraj poruku',
}: {
  text: string;
  className?: string;
  // Podrazumevano dugme se otkriva SAMO na hover preko roditeljske `group` klase (pojedinačna
  // poruka). "Kopiraj sav razgovor" (23.8.2026, na zahtev vlasnika) nije unutar takve grupe i
  // treba da bude stalno vidljivo — otud ovaj izlaz umesto novog, odvojenog dugmeta.
  alwaysVisible?: boolean;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard nedostupan (npr. nesiguran kontekst) — nema šta da se uradi, dugme ostaje tiho
        }
      }}
      title={copied ? 'Kopirano' : title}
      className={`${alwaysVisible ? '' : 'opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100'} ${copied ? 'text-ok' : 'text-ink-faint hover:text-ink'} ${className}`}
    >
      <Icon name={copied ? 'check' : 'copy'} />
    </button>
  );
}
