'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { useKatalog } from '@/components/KatalogContext';
import { connectionKey, readKatalogFilters } from '@/components/KatalogSidebarPanel';

export interface Product {
  id: string;
  type: string;
  destinationCountry: string;
  destinationCity: string;
  status: string;
  sourceType: string;
  sourceProvider?: string | null;
  translations?: { languageCode: string; name: string }[];
}

// Filteri su preseljeni u levi panel (4.9.2026, na zahtev vlasnika: "ove filtere stavite u levi
// panel kao sto smo uradili kod pretrage") — `KatalogSidebarPanel.tsx`, montiran iz
// `Sidebar.tsx` kad je aktivna sekcija "katalog". Ovaj komponent samo:
//  1. upisuje dobijenu listu proizvoda u `KatalogContext` da je panel u levoj traci može
//     pročitati (Sidebar je van stabla ove stranice — isti razlog kao `SearchStateContext`);
//  2. čita filtere iz adrese i prikazuje mrežu kartica koje im odgovaraju.
// Filtriranje ostaje trenutno i klijentsko nad već dobijenim podacima (isti princip kao
// `SearchSidebarPanel.tsx`, M5 §3.0g.1) — GET /catalog/products se poziva samo jednom, u page.tsx.
export default function KatalogCatalog({ products }: { products: Product[] }) {
  const sp = useSearchParams();
  const { setProducts } = useKatalog();

  useEffect(() => {
    setProducts(products);
  }, [products, setProducts]);

  const filters = readKatalogFilters(sp);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return products.filter((p) => {
      if (filters.tip && p.type !== filters.tip) return false;
      if (filters.status && p.status !== filters.status) return false;
      if (filters.drzava && p.destinationCountry !== filters.drzava) return false;
      if (filters.grad && p.destinationCity !== filters.grad) return false;
      if (filters.konekcija && connectionKey(p) !== filters.konekcija) return false;
      if (q) {
        const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '';
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, filters]);

  const activeCount = [filters.tip, filters.status, filters.drzava, filters.grad, filters.konekcija, filters.q].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-ink-faint">
        {filtered.length} {filtered.length === 1 ? 'proizvod' : 'proizvoda'} {activeCount > 0 && <>od ukupno {products.length}</>}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="text-xs text-ink-faint">
            {products.length === 0 ? 'Nema proizvoda u katalogu.' : 'Nijedan proizvod ne odgovara izabranim filterima.'}
          </p>
        )}
        {filtered.map((p) => {
          const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '(bez naziva)';
          return (
            <TabLink
              key={p.id}
              href={`/katalog/${p.id}`}
              label={name}
              className="rounded-lg border border-border bg-panel p-4 hover:border-accent"
              dragPayload={{
                key: `katalog:${p.id}`,
                moduleId: 'katalog-nabavka',
                label: name,
                subtitle: `${p.type} — ${p.destinationCity}, ${p.destinationCountry}`,
                href: `/katalog/${p.id}`,
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <Badge variant="outline" className="border-transparent bg-accent2-soft text-accent2">
                  {p.type}
                </Badge>
                <Badge variant={p.status === 'ACTIVE' ? 'ok' : 'secondary'} className={p.status === 'ACTIVE' ? '' : 'text-ink-faint'}>
                  {p.status}
                </Badge>
              </div>
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-faint">
                {p.destinationCity}, {p.destinationCountry}
              </div>
            </TabLink>
          );
        })}
      </div>
    </div>
  );
}
