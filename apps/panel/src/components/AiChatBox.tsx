'use client';

import { useState } from 'react';
import Icon from './Icon';
import Link from 'next/link';

interface OmnisearchResponse {
  active: boolean;
  matchedRoutes: { label: string; href: string }[];
  entityResults: { type: string; id: string; label: string; href: string }[];
  aiAnswer?: string;
}

interface Turn {
  question: string;
  answer?: string;
  links: { label: string; href: string }[];
  loading: boolean;
  inactive: boolean;
}

// Dizajn dok. §6c — polje za AI razgovor fiksirano pri dnu (centralnog panela kad je
// razgovor glavni sadržaj ekrana, ili desnog panela). Ovaj prvi prolaz namerno NE
// implementira §6c.1 (`+`/`@` prilaganje konteksta), §6c.2 (slash komande, dugme "Zaustavi",
// istorija po zapisu, traka mode/dozvola) ni §6c.3 (pravi streaming, izvori kao pilule,
// predložena sledeća pitanja) — svaki upit ide preko postojećeg POST /api/omnisearch
// (jednokratan poziv, M15 spec §9), bez memorije prethodnih poruka na serveru (backend
// prima samo `query`, ne istoriju) — istorija ispod je čisto prikazna, ne pravi razgovor sa
// kontekstom. Sve gore navedeno ostaje van obima, upisano u M17 spec.
export default function AiChatBox({ variant = 'inline' }: { variant?: 'inline' | 'panel' }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');

  async function send() {
    const question = input.trim();
    if (!question) return;
    setInput('');
    setTurns((t) => [...t, { question, links: [], loading: true, inactive: false }]);

    try {
      const res = await fetch('/api/omnisearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question }),
      });
      const data: OmnisearchResponse = await res.json();
      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (!data.active) {
          next[next.length - 1] = { ...last, loading: false, inactive: true };
          return next;
        }
        next[next.length - 1] = {
          ...last,
          loading: false,
          answer: data.aiAnswer,
          links: [...data.matchedRoutes],
        };
        return next;
      });
    } catch {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { ...next[next.length - 1], loading: false, answer: 'Zahtev nije uspeo — pokušaj ponovo.' };
        return next;
      });
    }
  }

  return (
    <div className={`flex flex-col ${variant === 'panel' ? 'h-full' : ''}`}>
      {turns.length > 0 && (
        <div className={`flex flex-col gap-3 overflow-y-auto ${variant === 'panel' ? 'flex-1 p-3' : 'max-h-64 py-2'}`}>
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="self-end rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-ink">{t.question}</div>
              {t.loading ? (
                <div className="flex items-center gap-2 text-xs text-ink-faint">
                  <Icon name="loading" className="animate-spin" /> razmišljam...
                </div>
              ) : t.inactive ? (
                <div className="rounded-lg border border-border bg-panel-2 px-3 py-1.5 text-xs text-ink-faint">
                  AI pretraga još nije uključena za ovaj panel.
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs text-ink">
                  {t.answer && <p>{t.answer}</p>}
                  {t.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          className="rounded-full border border-border bg-panel px-2 py-0.5 text-[11px] text-accent hover:border-accent"
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                  {!t.answer && t.links.length === 0 && <p className="text-ink-faint">Nema rezultata.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-border px-2 py-2">
        <Icon name="sparkle" className="text-accent" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Pitaj AI ili traži rezervaciju/proizvod..."
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          onClick={send}
          title="Pošalji"
          className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded hover:bg-panel-2 hover:text-accent"
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  );
}
