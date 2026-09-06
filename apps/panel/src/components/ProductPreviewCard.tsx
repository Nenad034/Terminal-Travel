'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import AddToAiContextButton from './AddToAiContextButton';
import { useProductPreview } from './ProductPreviewContext';
import { useTabs } from './TabsContext';

interface ProductPreviewDetail {
  id: string;
  name: string | null;
  description: string | null;
  city: string;
  country: string;
  stars: number | null;
  amenities: string[] | null;
  contact: { phone?: string; email?: string; address?: string } | null;
  photos: { url: string; caption: string | null; category: string }[];
}

// M17 spec "Desni panel — brzi pregled proizvoda" (26.8.2026, Faza B) — zamenjuje raniji MOCK
// (v1, 26.8.2026 ranije istog dana) stvarnim podacima preko `/api/catalog/products/:id/preview`
// BFF rute. Traka do 3 taba = `ProductPreviewContext` istorija (klik na naziv u rezultatima
// pretrage). Kešira po `productId` (stanje `cache`) da prebacivanje između tabova ne ponavlja fetch.
export default function ProductPreviewCard() {
  const { items, activeId, setActiveId } = useProductPreview();
  const { openTab } = useTabs();
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Keš je STANJE, ne `ref` (6.9.2026, ESLint `react-hooks/refs`, dok. 41 B2). Ranije je stajao
  // u `useRef`-u, čitao se usred rendera i ručno se okidalo ponovno iscrtavanje kroz neiskorišćen
  // `useState` brojač. To radi dok radi, ali render tada zavisi od vrednosti koju React ne prati:
  // podatak stigne, a ekran ga pokaže tek kad ga nešto drugo osveži. Kao stanje, keš preživljava
  // prebacivanje između tabova isto kao pre — `useState` vrednost se ne gubi između rendera.
  const [cache, setCache] = useState<Map<string, ProductPreviewDetail>>(new Map());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId || cache.has(activeId)) return;
    let cancelled = false;
    setLoadingId(activeId);
    setErrorId(null);
    fetch(`/api/catalog/products/${activeId}/preview`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: ProductPreviewDetail) => {
        if (cancelled) return;
        setCache((prethodni) => new Map(prethodni).set(activeId, data));
      })
      .catch(() => {
        if (!cancelled) setErrorId(activeId);
      })
      .finally(() => {
        if (!cancelled) setLoadingId(null);
      });
    return () => {
      cancelled = true;
    };
    // `cache` NIJE u listi zavisnosti namerno: efekat ga samo dopunjava, pa bi njegovo dodavanje
    // pokrenulo efekat ponovo posle svakog upisa. Provera `cache.has(activeId)` na vrhu čita
    // vrednost iz rendera u kom je efekat zakazan, što je ovde tačno ono što treba.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  if (!activeId) return null;
  const activeRef = items.find((i) => i.productId === activeId);
  const detail = cache.get(activeId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Traka do 3 taba — istorija poslednjih pregledanih proizvoda (LRU, ProductPreviewContext). */}
      <div className="flex flex-shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
        {items.map((i) => (
          <button
            key={i.productId}
            onClick={() => setActiveId(i.productId)}
            className={`truncate rounded px-2 py-1 text-[11px] font-medium ${
              i.productId === activeId ? 'bg-accent-soft text-accent-strong' : 'text-ink-faint hover:bg-panel hover:text-ink'
            }`}
            style={{ maxWidth: '33%' }}
          >
            {i.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loadingId === activeId && !detail && <p className="p-2 text-xs text-ink-faint">Učitavanje…</p>}
        {errorId === activeId && !detail && <p className="p-2 text-xs text-danger">Proizvod nije moguće učitati.</p>}

        {detail && (
          <>
            {detail.photos.length > 0 && (
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                {detail.photos.map((p) => (
                  <button key={p.url} onClick={() => setLightbox(p.url)} className="overflow-hidden rounded-md border border-border" title={p.caption ?? undefined}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption ?? ''} className="aspect-[3/2] w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-ink">{detail.name ?? activeRef?.name}</span>
                  {detail.stars !== null && (
                    <span className="rounded bg-panel2 px-1.5 py-0.5 text-[11px] font-semibold text-warn">{detail.stars}*</span>
                  )}
                </div>
                <div className="text-[11px] text-ink-faint">
                  {detail.country}, {detail.city}
                </div>
              </div>
              <AddToAiContextButton refLabel={detail.name ?? activeRef?.name ?? detail.id} />
            </div>
            {detail.description && <p className="mb-3 text-xs leading-relaxed text-ink-dim">{detail.description}</p>}

            <button
              onClick={() => openTab(`/katalog/${detail.id}/pregled`, detail.name ?? 'Proizvod')}
              className="mb-2 flex w-full items-center justify-center gap-1.5 rounded border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent hover:bg-accent-soft"
            >
              <Icon name="link-external" /> Prikaži pun opis
            </button>
          </>
        )}
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </div>
  );
}
