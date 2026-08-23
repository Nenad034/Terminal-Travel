'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';

const HEIGHT_KEY = 'tt-panel-terminal-height';
const DEFAULT_HEIGHT = 220;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 640;
function clampHeight(v: number) {
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, v));
}

interface Turn {
  question: string;
  answer?: string;
  links?: { label: string; href: string }[];
  loading: boolean;
  inactive: boolean;
  error?: string;
}

// M15 spec §6.9, dizajn dok. §5f — terminal-stilizovan panel, isključivo Vlasnik (RBAC
// sprovodi backend, ova komponenta se uopšte ne montira bez `M15/bi-terminal/VIEW`, vidi
// Shell.tsx). NIJE stvaran shell — svaki unos je pitanje na prirodnom jeziku ka kontrolisanom,
// samo-za-čitanje `BiTerminalAgent` (M15 spec §6.9.1-6.9.3), ne komanda operativnog sistema.
// "Obriši" red (X na redu) je isključivo klijentsko sakrivanje — stvaran zapis ostaje trajno u
// M1 audit logu (§6.9.4), dostupan preko /audit-log filtriranog na module=M15,
// action=bi-terminal.query.
export default function TerminalPanel({ onClose }: { onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Promenljiva visina (23.8.2026, na zahtev vlasnika: "omogucite povecavanje visine
  // terminala") — isti obrazac kao `ResizablePane.tsx` (prevlačenje, dvoklik vraća
  // podrazumevanu, localStorage), samo vertikalno umesto horizontalno. Ručka je na GORNJOJ
  // ivici (panel raste naviše kad se povuče, isto kao VS Code Panel).
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(DEFAULT_HEIGHT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HEIGHT_KEY);
      if (raw) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) setHeight(clampHeight(parsed));
      }
    } catch {
      // localStorage nedostupan — ostaje podrazumevana visina
    }
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    // Ručka je na vrhu — prevlačenje naGORE (manji clientY) treba da POVEĆA visinu.
    setHeight(clampHeight(startHeight.current - (e.clientY - startY.current)));
  }, []);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    setHeight((h) => {
      try {
        localStorage.setItem(HEIGHT_KEY, String(h));
      } catch {
        // localStorage nedostupan — visina i dalje radi za ovu sesiju
      }
      return h;
    });
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    startY.current = e.clientY;
    startHeight.current = height;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const resetHeight = () => {
    setHeight(DEFAULT_HEIGHT);
    try {
      localStorage.setItem(HEIGHT_KEY, String(DEFAULT_HEIGHT));
    } catch {
      // localStorage nedostupan — reset i dalje radi za ovu sesiju
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns]);

  async function send() {
    const question = input.trim();
    if (!question) return;
    setInput('');
    setTurns((t) => [...t, { question, loading: true, inactive: false }]);

    try {
      const res = await fetch('/api/bi-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question }),
      });
      const data: { active?: boolean; answer?: string; links?: { label: string; href: string }[]; message?: string } = await res.json();
      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (res.status === 401) {
          next[next.length - 1] = { ...last, loading: false, error: 'Sesija je istekla — osveži stranicu i prijavi se ponovo.' };
          return next;
        }
        if (!data.active) {
          next[next.length - 1] = { ...last, loading: false, inactive: true };
          return next;
        }
        next[next.length - 1] = { ...last, loading: false, answer: data.answer, links: data.links };
        return next;
      });
    } catch {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { ...next[next.length - 1], loading: false, error: 'Zahtev nije uspeo — pokušaj ponovo.' };
        return next;
      });
    }
  }

  function hideRow(index: number) {
    // Klijentsko sakrivanje SAMO za ovaj prikaz — audit log zapis (§6.9.4) ostaje trajno na
    // serveru, ovo ne šalje nikakav DELETE poziv jer takav poziv namerno ne postoji.
    setTurns((t) => t.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-shrink-0 flex-col overflow-hidden bg-panel font-mono text-xs" style={{ height }}>
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={resetHeight}
        title="Prevuci za promenu visine, dvoklik za podrazumevanu"
        className={`h-1.5 flex-shrink-0 cursor-row-resize border-t hover:border-accent ${dragging ? 'border-accent' : 'border-transparent'}`}
      />
      <div className="flex h-[29px] flex-shrink-0 items-center justify-between border-t border-ink-faint bg-panel-2 px-3">
        <span className="flex items-center gap-1.5 text-ink-dim">
          <Icon name="terminal" /> TERMINAL
        </span>
        <button onClick={onClose} title="Zatvori terminal" className="text-ink-faint hover:text-ink">
          <Icon name="close" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {turns.length === 0 && <p className="text-ink-faint">Postavi pitanje o poslovanju — npr. "šta je danas prodato", "lista nenaplaćenih aranžmana".</p>}
        {turns.map((t, i) => (
          <div key={i} className="group mb-2 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-accent">
                $ <span className="text-ink">{t.question}</span>
              </span>
              <button
                onClick={() => hideRow(i)}
                title="Ukloni sa prikaza (trag ostaje u audit logu)"
                className="opacity-0 text-ink-faint hover:text-danger group-hover:opacity-100"
              >
                <Icon name="close" />
              </button>
            </div>
            {t.loading ? (
              <span className="flex items-center gap-2 text-ink-faint">
                <Icon name="loading" className="animate-spin" /> obrađujem...
              </span>
            ) : t.error ? (
              <span className="text-danger">{t.error}</span>
            ) : t.inactive ? (
              <span className="text-ink-faint">Terminal još nije aktiviran.</span>
            ) : (
              <>
                <pre className="whitespace-pre-wrap text-ink-dim">{t.answer}</pre>
                {t.links && t.links.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {t.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        target="_blank"
                        className="rounded border border-ink-faint px-2 py-0.5 text-[11px] text-accent hover:border-accent"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-ink-faint px-3 py-2">
        <span className="text-accent">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="pitaj o poslovanju..."
          className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
    </div>
  );
}
