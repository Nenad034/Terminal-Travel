'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import Link from 'next/link';
import { useTabs } from './TabsContext';
import { NAV_ITEMS } from '@/lib/nav';

// Ispisivanje reč-po-reč (na zahtev vlasnika, 19.8.2026 — "kao u AI pretrazi u Chrome ili u
// VS Code"). Odgovor i dalje stiže u JEDNOM odgovoru sa servera (M15 omnisearch nema pravi
// streaming, poglavlje 6c.3 ostaje van obima) — ovo je čisto vizuelna animacija otkrivanja
// već primljenog teksta, ne prava postepena generacija. Poštuje `prefers-reduced-motion`
// (dizajn dok. poglavlje 6 — animacija nikad ne sme biti jedini nosilac informacije).
function TypewriterText({ text }: { text: string }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      return;
    }
    const words = text.split(' ');
    let i = 0;
    setShown('');
    const t = setInterval(() => {
      i += 1;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) clearInterval(t);
    }, 35);
    return () => clearInterval(t);
  }, [text]);
  return <p>{shown}</p>;
}

interface OmnisearchResponse {
  active: boolean;
  matchedRoutes: { label: string; href: string }[];
  entityResults: { type: string; id: string; label: string; href: string }[];
  aiAnswer?: string;
}

interface Turn {
  question: string;
  contextLabel?: string;
  answer?: string;
  links: { label: string; href: string }[];
  loading: boolean;
  inactive: boolean;
}

// Prečice ispod polja za unos (dizajn dok. §6c — "šta još"), na zahtev vlasnika 19.8.2026.
const QUICK_LINK_IDS = ['pretraga', 'crm', 'katalog', 'podrska'];

// Dizajn dok. §6c/§6c.1 — polje za AI razgovor fiksirano pri dnu centralnog panela, na SVAKOM
// ekranu bez obzira koji modul je aktivan (ispravka 19.8.2026, na zahtev vlasnika — prvi
// pokušaj ga je stavio u poseban desni panel, vlasnik je tražio centralni). `+` prilaže
// kontekst (trenutno otvoren zapis / rezultati trenutne pretrage) kao čip iznad polja —
// jedino dvoje od §6c.1 stvarno izvodljivo bez dodatnog backend rada (prilog fajla i
// pretraga interneta zahtevaju M15 alate koji još ne postoje za ovaj kanal, van obima).
// Svaki upit i dalje ide preko postojećeg POST /api/omnisearch (jednokratan poziv, M15 spec
// §9), bez memorije prethodnih poruka na serveru — istorija ispod je čisto prikazna.
// Slash komande, dugme "Zaustavi", istorija po zapisu, traka mode/dozvola (§6c.2), pravi
// streaming/izvori-kao-pilule-sa-tipom/predložena pitanja (§6c.3) ostaju van obima.
export default function AiChatBox() {
  const { tabs, activePath, openTab } = useTabs();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<string | null>(null);
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.path === activePath);
  const isSearchTab = activePath.startsWith('/rezervacije/pretraga') && activePath.includes('?');

  async function send() {
    const question = input.trim();
    if (!question) return;
    const sentContext = context ?? undefined;
    setInput('');
    setContext(null);
    setTurns((t) => [...t, { question, contextLabel: sentContext, links: [], loading: true, inactive: false }]);

    const query = sentContext ? `[Kontekst: ${sentContext}] ${question}` : question;
    try {
      const res = await fetch('/api/omnisearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data: OmnisearchResponse = await res.json();
      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        if (!data.active) {
          next[next.length - 1] = { ...last, loading: false, inactive: true };
          return next;
        }
        next[next.length - 1] = { ...last, loading: false, answer: data.aiAnswer, links: [...data.matchedRoutes] };
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

  const quickLinks = QUICK_LINK_IDS.map((id) => NAV_ITEMS.find((i) => i.id === id)).filter((i): i is (typeof NAV_ITEMS)[number] => Boolean(i));

  return (
    <div className="flex flex-col">
      {turns.length > 0 && <div className="flex max-h-64 flex-col gap-3 overflow-y-auto py-2">
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              {t.contextLabel && <div className="self-end text-[10px] italic text-ink-faint">kontekst: {t.contextLabel}</div>}
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
                  {t.answer && <TypewriterText text={t.answer} />}
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
        </div>}

      {context && (
        <div className="mx-2 mt-2 flex items-center gap-1.5 self-start rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] text-ink">
          <Icon name="link" />
          {context}
          <button onClick={() => setContext(null)} title="Ukloni kontekst" className="ml-0.5 hover:text-danger">
            <Icon name="close" />
          </button>
        </div>
      )}

      {/* Linije chata pojačane (21.8.2026, na zahtev vlasnika: "pojacajte boji linija chata
          jedva se vide u light modu, u dark modu neka budu jos svetlije") — `border-border`
          (§komentar globals.css, misli se za blage unutrašnje razdelnike) je bio praktično
          nevidljiv na belu/skoro-belu pozadinu u svetlom modu. Zamenjeno postojećim
          `ink.faint` tokenom (već prolazi 4.5:1 tekst-kontrast, dakle daleko iznad 3:1 praga
          za granice — §2a) — u svetlom modu tamniji/vidljiviji, a u tamnom modu SVETLIJI od
          `--border` (isti smer koji je vlasnik tražio), bez novog CSS tokena.

          Okvir OKO ovog dela (21.8.2026, drugi zahtev istog dana, uz snimak ekrana: "ovako
          treba da bude oivicen chat... Linija ne treba da ide u unutrasnjost panela") — ranije
          probano na `Shell.tsx` omotaču (`border-x`) je razvlačilo liniju kroz CEO
          `AiChatBox`, uključujući istoriju razgovora iznad (unutrašnjost panela) — POVUČENO.

          TREĆI ZAHTEV (21.8.2026, isti dan): "Uklonite linije gornjeg dela chata ostaje
          uokviren samo donji deo" — zajednički okvir oko OBA reda (unos + prečice) je i dalje
          crtao liniju oko gornjeg (unos) reda, što nije bilo traženo. Red za unos sad je bez
          ikakvog okvira; pun okvir (`border border-ink-faint`) ostaje SAMO oko donjeg reda
          (brze prečice). */}
      <div className="flex flex-shrink-0 items-center gap-2 px-2 py-2">
        <div ref={plusRef} className="relative">
          <button
            onClick={() => setPlusOpen((v) => !v)}
            title="Priloži kontekst"
            className={`flex h-[31px] w-[31px] items-center justify-center rounded ${plusOpen ? 'bg-panel-2 text-accent' : 'hover:bg-panel-2 hover:text-ink'}`}
          >
            <Icon name="add" />
          </button>
          {plusOpen && (
            <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
              <button
                disabled={!activeTab || activeTab.path === '/'}
                onClick={() => {
                  if (activeTab) setContext(activeTab.label);
                  setPlusOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon name="file" /> Trenutno otvoren zapis{activeTab && activeTab.path !== '/' ? ` — ${activeTab.label}` : ''}
              </button>
              <button
                disabled={!isSearchTab}
                onClick={() => {
                  setContext('rezultati trenutne pretrage');
                  setPlusOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Icon name="search" /> Rezultati trenutne pretrage
              </button>
            </div>
          )}
        </div>
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
          className="flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded hover:bg-panel-2 hover:text-accent"
        >
          <Icon name="send" />
        </button>
      </div>

      {/* Centrirano (21.8.2026, na zahtev vlasnika: "centrirajte tagove na sredinu donje
          polovine chata") — ranije levo poravnato (`flex flex-wrap`), sad `justify-center`. */}
      <div className="flex flex-wrap justify-center gap-1.5 border border-ink-faint px-2 py-1.5">
        {quickLinks.map((item) => (
          <button
            key={item.id}
            onClick={() => openTab(item.href, item.label)}
            className="flex items-center gap-1 rounded-full border border-ink-faint px-2 py-0.5 text-[11px] text-ink-faint hover:border-accent hover:text-ink"
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
