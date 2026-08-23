'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import CopyButton from './CopyButton';

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
  report?: { id: string; format: 'EXCEL' | 'PDF' | 'HTML'; fileName: string };
  toolsCalled?: string[];
  pendingWebFetch?: { url: string; reason: string; originalQuestion: string };
  webFetchDecision?: 'approved' | 'denied';
  loading: boolean;
  inactive: boolean;
  error?: string;
}

interface Conversation {
  id: string;
  name: string | null;
  type: string;
}

// M15 spec §6.9.3 dopuna (23.8.2026, na zahtev vlasnika: "omogucite... slanje svega toga putem
// internog chata") — "predloži pa čovek odobri": ovo dugme je JEDINI način da izveštaj stvarno
// ode negde, `BiTerminalAgent` sam nikad ne poziva ovaj endpoint iz tool-use petlje (samo
// `generate_report`, priprema fajl). Mejl namerno nije ponuđen ovde — M22 danas ume samo da
// odgovori unutar postojećeg niza poruka, nema "novi mejl proizvoljnom primaocu" (§6.9.3
// dopuna, otvorena stavka, čeka poseban prolaz).
function ReportCard({ report }: { report: NonNullable<Turn['report']> }) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPicker() {
    setPickerOpen((v) => !v);
    if (conversations === null) {
      const res = await fetch('/api/chat/conversations');
      if (res.ok) setConversations(await res.json());
      else setConversations([]);
    }
  }

  async function sendTo(conversation: Conversation) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bi-terminal/reports/${report.id}/send-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.id }),
      });
      if (!res.ok) throw new Error();
      setSentTo(conversation.name ?? conversation.type);
      setPickerOpen(false);
    } catch {
      setError('Slanje nije uspelo — izveštaj je možda istekao (30 min), zatraži ga ponovo.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded border border-ink-faint bg-panel-2 px-2.5 py-2">
      <div className="flex items-center gap-2 text-ink">
        <Icon name="file" />
        {report.fileName}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <a
          href={`/api/bi-terminal/reports/${report.id}/download`}
          className="rounded border border-ink-faint px-2 py-0.5 text-[11px] text-accent hover:border-accent"
        >
          Preuzmi
        </a>
        <div className="relative">
          <button
            onClick={openPicker}
            className="rounded border border-ink-faint px-2 py-0.5 text-[11px] text-accent hover:border-accent"
          >
            Pošalji u chat
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded border border-border bg-panel py-1 shadow-lg">
              {conversations === null ? (
                <div className="px-3 py-1.5 text-ink-faint">učitavam...</div>
              ) : conversations.length === 0 ? (
                <div className="px-3 py-1.5 text-ink-faint">Nema dostupnih razgovora.</div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    disabled={sending}
                    onClick={() => sendTo(c)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40"
                  >
                    {c.name ?? c.type}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      {sentTo && <span className="flex items-center gap-1 text-ok">
        <Icon name="check" /> Poslato u "{sentTo}"
      </span>}
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
}

// M15 spec §6.9.7 — predlog agenta da poseti konkretan URL. NIŠTA se ne preuzima dok Vlasnik ne
// klikne "Odobri" — isti "predloži pa čovek odobri" obrazac kao ReportCard iznad, samo za web
// pristup umesto slanja izveštaja. Vizuelno izdvojeno (warn okvir) da se jasno razlikuje od
// običnog odgovora, dizajn dok. §5f dopuna.
function WebFetchApprovalCard({
  pending,
  decision,
  onDecide,
}: {
  pending: NonNullable<Turn['pendingWebFetch']>;
  decision: Turn['webFetchDecision'];
  onDecide: (decision: 'approved' | 'denied', answer: string, links?: Turn['links']) => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: 'approve' | 'deny') {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/bi-terminal/web-fetch/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      onDecide(action === 'approve' ? 'approved' : 'denied', data.answer ?? '', data.links);
    } catch {
      setError('Zahtev nije uspeo — pokušaj ponovo.');
    } finally {
      setWorking(false);
    }
  }

  if (decision) {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-ink-faint">
        <Icon name={decision === 'approved' ? 'check' : 'close'} />
        {decision === 'approved' ? 'Odobreno — sadržaj preuzet i proveren.' : 'Odbijeno — ništa nije preuzeto.'}
      </div>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded border border-warn bg-warn-bg px-2.5 py-2">
      <div className="flex items-center gap-2 text-warn">
        <Icon name="globe" /> Agent predlaže odlazak na internet
      </div>
      <div className="text-ink-dim">{pending.reason}</div>
      <div className="truncate text-ink-faint" title={pending.url}>
        {pending.url}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          disabled={working}
          onClick={() => decide('approve')}
          className="rounded border border-ok px-2 py-0.5 text-[11px] text-ok hover:bg-ok-bg disabled:opacity-40"
        >
          Odobri
        </button>
        <button
          disabled={working}
          onClick={() => decide('deny')}
          className="rounded border border-ink-faint px-2 py-0.5 text-[11px] text-ink-faint hover:border-danger hover:text-danger disabled:opacity-40"
        >
          Odbij
        </button>
        {working && <Icon name="loading" className="animate-spin text-ink-faint" />}
      </div>
      {error && <span className="text-danger">{error}</span>}
    </div>
  );
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
    // Istorija (23.8.2026, na zahtev vlasnika — "ai agent gubi kontekst") — pošalji dosadašnje
    // tekstualne odgovore da agent razume reference tipa "te rezervacije" na prethodno pitanje.
    // Samo tura sa stvarnim odgovorom (ne učitavanje/greška/predlog na čekanju) ima šta da doprinese.
    const history = turns.filter((t) => t.answer && !t.loading).map((t) => ({ question: t.question, answer: t.answer! }));
    setTurns((t) => [...t, { question, loading: true, inactive: false }]);

    try {
      const res = await fetch('/api/bi-terminal/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, history }),
      });
      const data: {
        active?: boolean;
        answer?: string;
        links?: { label: string; href: string }[];
        report?: Turn['report'];
        toolsCalled?: string[];
        pendingWebFetch?: Turn['pendingWebFetch'];
        message?: string;
      } = await res.json();
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
        next[next.length - 1] = {
          ...last,
          loading: false,
          answer: data.answer,
          links: data.links,
          report: data.report,
          toolsCalled: data.toolsCalled,
          pendingWebFetch: data.pendingWebFetch,
        };
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

  // Kopiranje CELOG razgovora (23.8.2026, na zahtev vlasnika: "omoguci kopiranja svih poruka ne
  // samo pojedinacnih") — dopuna uz postojeći CopyButton po poruci, ne zamena. Isti tekstualni
  // oblik kao pojedinačan prikaz ($ pitanje / odgovor), tura po turu, radi lepljenja u drugi alat.
  function buildFullTranscriptText(): string {
    return turns
      .map((t) => {
        const lines = [`$ ${t.question}`];
        if (t.pendingWebFetch && !t.webFetchDecision) {
          lines.push(`[predlog: poseti ${t.pendingWebFetch.url} — čeka odobrenje]`);
        } else if (t.answer) {
          lines.push(t.answer);
        } else if (t.error) {
          lines.push(t.error);
        } else if (t.inactive) {
          lines.push('Terminal još nije aktiviran.');
        }
        return lines.join('\n');
      })
      .join('\n\n');
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
        <div className="flex items-center gap-2">
          {turns.length > 0 && (
            <CopyButton text={buildFullTranscriptText()} alwaysVisible title="Kopiraj ceo razgovor" className="text-ink-faint hover:text-ink" />
          )}
          <button onClick={onClose} title="Zatvori terminal" className="text-ink-faint hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2">
        {turns.length === 0 && <p className="text-ink-faint">Postavi pitanje o poslovanju — npr. "šta je danas prodato", "lista nenaplaćenih aranžmana".</p>}
        {turns.map((t, i) => (
          <div key={i} className={`group flex flex-col gap-1 py-2 ${i > 0 ? 'border-t border-ink-faint/40' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-1.5 text-accent">
                $ <span className="text-ink">{t.question}</span>
                <CopyButton text={t.question} />
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
                {t.toolsCalled && t.toolsCalled.length > 0 && (
                  <div className="text-ink-faint">⟶ {t.toolsCalled.join(', ')}</div>
                )}
                {t.pendingWebFetch && !t.webFetchDecision ? (
                  <WebFetchApprovalCard
                    pending={t.pendingWebFetch}
                    decision={t.webFetchDecision}
                    onDecide={(decision, answer, links) =>
                      setTurns((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], webFetchDecision: decision, answer: answer || next[i].answer, links: links ?? next[i].links };
                        return next;
                      })
                    }
                  />
                ) : (
                  <>
                    {t.webFetchDecision === 'denied' && (
                      <div className="flex items-center gap-1.5 text-ink-faint">
                        <Icon name="close" /> Odbijeno — ništa nije preuzeto sa interneta.
                      </div>
                    )}
                    {t.answer && (
                      <div className="flex items-start gap-1.5">
                        <pre className="flex-1 whitespace-pre-wrap text-ink-dim">{t.answer}</pre>
                        <CopyButton text={t.answer} />
                      </div>
                    )}
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
                    {t.report && <ReportCard report={t.report} />}
                  </>
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
