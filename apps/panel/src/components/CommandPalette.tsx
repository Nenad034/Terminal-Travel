'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import type { NavItem } from '@/lib/nav';

// docs/analize/29-DIZAJN-SISTEM-UI.md §4, M17 spec §5.5 — Ctrl+K/Cmd+K overlay.
//
// "Prazan upit + Enter" -> navigacija filtrirana na ulogu (isti izvor kao bočna traka).
// "Upit sa tekstom" bi po spec-u pozivao POST /ai-orchestration/omnisearch (M15 poglavlje
// 9) — M15 NE POSTOJI još u kodu (apps/api/src/modules nema m15-*, provereno avgust 2026).
// Ovaj prolaz zato implementira PRIVREMENU lokalnu zamenu: substring/fuzzy pretragu kroz
// navigacione stavke vidljive korisniku, ništa više. Kad M15 omnisearch endpoint postoji,
// ovaj deo se zamenjuje pravim pozivom (M17 spec §5.5, §8 "Otvoreno za dalje" ovog modula
// dokumentuje tu obavezu). Glasovni unos (M17 spec §5.5 dopuna) iz istog razloga nije
// implementiran u ovom prolazu.
export default function CommandPalette({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelected(0);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const results = useMemo(() => {
    const implemented = items.filter((i) => i.implemented);
    if (!query.trim()) return implemented;
    const q = query.toLowerCase();
    return implemented.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query]);

  function go(item: NavItem) {
    router.push(item.href);
    setOpen(false);
  }

  if (!open) return null;

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
                setSelected((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === 'Enter' && results[selected]) {
                go(results[selected]);
              }
            }}
            placeholder="traži sekciju panela…"
            className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-border bg-panel-2 px-1.5 py-0.5 text-[10px] text-ink-faint">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="p-4 text-center text-xs text-ink-faint">
              Nema rezultata u navigaciji — prava AI pretraga (M15) još ne postoji.
            </p>
          )}
          {results.map((item, idx) => (
            <div
              key={item.id}
              onMouseEnter={() => setSelected(idx)}
              onClick={() => go(item)}
              className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 text-sm ${
                idx === selected ? 'bg-accent-soft text-accent-strong' : 'text-ink'
              }`}
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
