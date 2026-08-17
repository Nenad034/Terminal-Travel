'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { OmnisearchResult } from '@/lib/types';

// M8 spec §3a, M15 spec §6.5.5 — omnisearch traka za B2C_SITE kanal. Prazan upit + Enter/fokus
// prikazuje statičnu, ulogom filtriranu navigaciju BEZ poziva ka M15 (§6.5.3 — "ne ide kroz
// OmnisearchAgent"). Uneti tekst poziva POST /api/omnisearch (server-to-server preko Next.js
// route handlera, §1 BFF pravilo) — nikad direktno ka apps/api iz browsera.
export default function OmnisearchBar({
  locale,
  isLoggedIn,
  labels,
}: {
  locale: string;
  isLoggedIn: boolean;
  labels: {
    placeholder: string;
    destinations: string;
    myBookings: string;
    help: string;
    helpHint: string;
    loading: string;
    noResults: string;
  };
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<OmnisearchResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function runSearch(q: string) {
    setPending(true);
    setResult(null);
    try {
      const res = await fetch('/api/omnisearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, lang: locale }),
      });
      const body = (await res.json()) as OmnisearchResult;
      setResult(body);
    } catch {
      setResult({ active: false, matchedRoutes: [], entityResults: [] });
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOpen(true);
    if (query.trim().length === 0) {
      setResult(null); // prazan upit — samo statična navigacija ispod, bez AI poziva (§6.5.3)
      return;
    }
    void runSearch(query.trim());
  }

  function onHelpHintClick() {
    setQuery(labels.helpHint);
    setOpen(true);
    setResult(null);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={onSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={labels.placeholder}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-96 overflow-y-auto rounded-md border border-border bg-panel p-3 shadow-lg">
          {query.trim().length === 0 && !result && (
            <nav className="flex flex-col gap-2 text-sm">
              <Link href={`/${locale}/pretraga`} className="rounded px-2 py-1.5 text-ink hover:bg-bg hover:text-accent" onClick={() => setOpen(false)}>
                {labels.destinations}
              </Link>
              {isLoggedIn && (
                <Link
                  href={`/${locale}/nalog/moje-rezervacije`}
                  className="rounded px-2 py-1.5 text-ink hover:bg-bg hover:text-accent"
                  onClick={() => setOpen(false)}
                >
                  {labels.myBookings}
                </Link>
              )}
              <button type="button" onClick={onHelpHintClick} className="rounded px-2 py-1.5 text-left text-ink hover:bg-bg hover:text-accent">
                {labels.help}
              </button>
            </nav>
          )}

          {pending && <p className="p-2 text-sm text-ink-faint">{labels.loading}</p>}

          {result && !pending && (
            <div className="flex flex-col gap-3">
              {result.entityResults.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {result.entityResults.map((r) => (
                    <li key={`${r.type}-${r.id}`}>
                      <Link
                        href={`/${locale}${r.href}`}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-ink hover:bg-bg hover:text-accent"
                        onClick={() => setOpen(false)}
                      >
                        {r.media?.[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.media[0].url} alt="" className="h-8 w-8 rounded object-cover" />
                        )}
                        <span>{r.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {result.aiAnswer && <p className="rounded bg-bg p-3 text-sm text-ink-dim">{result.aiAnswer}</p>}

              {result.entityResults.length === 0 && !result.aiAnswer && (
                <p className="p-2 text-sm text-ink-faint">{labels.noResults}</p>
              )}
            </div>
          )}
        </div>
      )}

      {open && (
        // Klik van panela ga zatvara — prost overlay, bez dodatne biblioteke.
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </div>
  );
}
