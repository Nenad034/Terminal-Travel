'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { useTabs } from './TabsContext';
import type { NavItem } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §4, M17 spec §5.5, M15 spec §6.5 — Ctrl+K/Cmd+K overlay.
// "Prazan upit + Enter" ostaje čisto lokalna navigacija (§6.5.3, ne zove API). "Upit sa
// tekstom" poziva POST /api/omnisearch (→ M15 POST /ai-orchestration/omnisearch) — glasovni
// unos (§6.6) i M15 §6.5.6 spoljne recenzije ostaju van obima ovog prolaza.
export default function CommandPalette({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [aiState, setAiState] = useState<AiSearchState>({ status: 'idle' });
  const router = useRouter();
  const { tabs, activePath } = useTabs();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelected(0);
        setAiState({ status: 'idle' });
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Statička navigacija (uvek dostupna, filtrirana na ulogu) — §6.5.3 prazan upit + Enter,
  // i fallback dok AI odgovor stiže / ako AI sloj nije dostupan.
  const navResults = useMemo(() => {
    const implemented = items.filter((i) => i.implemented);
    if (!query.trim()) return implemented;
    const q = query.toLowerCase();
    return implemented.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  // docs/analize/29-DIZAJN-SISTEM-UI.md §4 — prazan upit prikazuje i nedavno otvorene
  // zapise/tabove iznad pune nav liste (isti obrazac kao Linear/Spotlight), brz povratak na
  // ono na čemu se upravo radilo.
  const recentTabs = useMemo(() => tabs.filter((t) => t.path !== activePath).slice(-5).reverse(), [tabs, activePath]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setAiState({ status: 'idle' });
      return;
    }
    setAiState({ status: 'loading' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/omnisearch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setAiState({ status: 'error' });
          return;
        }
        const data = (await res.json()) as OmnisearchResponse;
        setAiState({ status: 'done', data });
      } catch {
        if (!controller.signal.aborted) setAiState({ status: 'error' });
      }
    }, 300); // kratak debounce — ne zvati API na svaki taster

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(href: string) {
    router.push(href);
    setOpen(false);
  }

  if (!open) return null;

  const showAiPanel = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh] animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg animate-scale-in overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="font-mono font-bold text-accent">›</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, navResults.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === 'Enter' && !showAiPanel && navResults[selected]) {
                go(navResults[selected].href);
              }
            }}
            placeholder="traži sekciju panela ili postavi pitanje…"
            className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-border bg-panel-2 px-1.5 py-0.5 text-[11px] text-ink-faint">Esc</kbd>
        </div>

        {!showAiPanel && (
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {!query.trim() && recentTabs.length > 0 && (
              <div className="mb-2 border-b border-border pb-2">
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Nedavno otvoreno</p>
                {recentTabs.map((tab) => (
                  <div
                    key={tab.path}
                    onClick={() => go(tab.path)}
                    className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-panel-2"
                  >
                    <Icon name="history" />
                    <span className="flex-1 truncate">{tab.label}</span>
                  </div>
                ))}
              </div>
            )}
            {navResults.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-faint">Nema rezultata u navigaciji.</p>
            )}
            {navResults.map((item, idx) => (
              <div
                key={item.id}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => go(item.href)}
                className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm ${
                  idx === selected ? 'bg-accent-soft text-accent-strong' : 'text-ink'
                }`}
              >
                <Icon name={item.icon} />
                <span className="flex-1">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {showAiPanel && (
          <div className="max-h-[60vh] overflow-y-auto p-2">
            <AiSearchPanel state={aiState} onGo={go} navFallback={navResults} />
          </div>
        )}
      </div>
    </div>
  );
}

interface MatchedRoute {
  label: string;
  href: string;
}

interface EntityResult {
  type: 'BOOKING' | 'PRODUCT';
  id: string;
  label: string;
  href: string;
  media?: { url: string; category: string }[] | null;
}

interface OmnisearchResponse {
  active: boolean;
  matchedRoutes: MatchedRoute[];
  entityResults: EntityResult[];
  aiAnswer?: string;
}

type AiSearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; data: OmnisearchResponse };

// M15 spec §6.5, M17 spec §5.5 — prikaz AI odgovora/rezultata. Kad modul nije aktiviran
// (active:false), poruka je smirena, ne izgleda kao greška, i navigacioni fallback ostaje
// vidljiv da paleta nikad ne bude "pokvarena" za korisnika (M17 spec §7).
function AiSearchPanel({ state, onGo, navFallback }: { state: AiSearchState; onGo: (href: string) => void; navFallback: NavItem[] }) {
  if (state.status === 'loading' || state.status === 'idle') {
    return <p className="p-4 text-center text-xs text-ink-faint">Tražim…</p>;
  }
  if (state.status === 'error') {
    return (
      <div className="p-2">
        <p className="px-2 py-2 text-xs text-ink-faint">AI pretraga trenutno nije dostupna. Navigacija i dalje radi:</p>
        <NavFallbackList items={navFallback} onGo={onGo} />
      </div>
    );
  }

  const { data } = state;
  if (!data.active) {
    return (
      <div className="p-2">
        <p className="px-2 py-2 text-xs text-ink-faint">AI pretraga još nije uključena za ovaj panel. Navigacija i dalje radi:</p>
        <NavFallbackList items={navFallback} onGo={onGo} />
      </div>
    );
  }

  const nothingFound = data.matchedRoutes.length === 0 && data.entityResults.length === 0 && !data.aiAnswer;

  return (
    <div className="space-y-2 p-1">
      {data.aiAnswer && (
        <div className="rounded-md border border-border bg-panel-2 p-3 text-sm text-ink">{data.aiAnswer}</div>
      )}
      {data.entityResults.map((r) => (
        <div
          key={`${r.type}-${r.id}`}
          onClick={() => onGo(r.href)}
          className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-accent-soft hover:text-accent-strong"
        >
          {r.media?.[0]?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.media[0].url} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <Icon name={r.type === 'BOOKING' ? 'calendar' : 'library'} />
          )}
          <span className="flex-1">{r.label}</span>
        </div>
      ))}
      {data.matchedRoutes
        .filter((m) => !data.entityResults.some((r) => r.href === m.href))
        .map((m) => (
          <div
            key={m.href}
            onClick={() => onGo(m.href)}
            className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-accent-soft hover:text-accent-strong"
          >
            <Icon name="link" />
            <span className="flex-1">{m.label}</span>
          </div>
        ))}
      {nothingFound && <p className="p-4 text-center text-xs text-ink-faint">Nema rezultata za ovaj upit.</p>}
    </div>
  );
}

function NavFallbackList({ items, onGo }: { items: NavItem[]; onGo: (href: string) => void }) {
  return (
    <>
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onGo(item.href)}
          className="flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm text-ink hover:bg-accent-soft hover:text-accent-strong"
        >
          <Icon name={item.icon} />
          <span className="flex-1">{item.label}</span>
        </div>
      ))}
    </>
  );
}
