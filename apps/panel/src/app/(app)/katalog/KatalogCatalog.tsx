'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { useKatalog } from '@/components/KatalogContext';
import { useRowSummary } from '@/components/RowSummaryContext';
import { useTabs } from '@/components/TabsContext';
import ProductScopeFilterBar from '@/components/ProductScopeFilterBar';
import { PANEL_ITEM_DRAG_MIME } from '@/components/PanelCollectionContext';
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
  /** M2 §7 (9.9.2026) — razrešen naziv dobavljača (kroz ugovor ili direktan, za ručne usluge). */
  supplierName?: string | null;
}

// M17 spec §7a (dopuna 9.9.2026, vlasnikov zahtev). Traka na ekranu stoji UZ postojeće filtere u
// levoj traci (vlasnikova odluka 9.9.2026 — levi panel ostaje), ali ne duplira ih: levi panel
// bira TAČNE vrednosti iz čekboks liste, ova traka je slobodan tekst („sadrži"), plus polje za
// dobavljača kog levi panel uopšte nema. Vrsta proizvoda je JEDINO zajedničko polje i namerno
// deli isti parametar `tip` — traka ikonica i čekboksi levog panela pokazuju isti izbor, umesto
// dva filtera koja se međusobno ne vide.
const SCOPE_POLJA = {
  productType: 'tip',
  destinationCountry: 'drzavaQ',
  destinationCity: 'mestoQ',
  productName: 'hotelQ',
  supplier: 'dobavljacQ',
} as const;

function sadrzi(vrednost: string | null | undefined, trazi: string): boolean {
  return (vrednost ?? '').toLowerCase().includes(trazi.toLowerCase());
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
  const { showSummary } = useRowSummary();
  const { openTab } = useTabs();

  useEffect(() => {
    setProducts(products);
  }, [products, setProducts]);

  const filters = readKatalogFilters(sp);
  // Slobodan tekst iz trake na ekranu — odvojen od čekboks filtera levog panela (v. SCOPE_POLJA).
  const drzavaQ = sp?.get(SCOPE_POLJA.destinationCountry)?.trim() ?? '';
  const mestoQ = sp?.get(SCOPE_POLJA.destinationCity)?.trim() ?? '';
  const hotelQ = sp?.get(SCOPE_POLJA.productName)?.trim() ?? '';
  const dobavljacQ = sp?.get(SCOPE_POLJA.supplier)?.trim() ?? '';

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return products.filter((p) => {
      if (drzavaQ && !sadrzi(p.destinationCountry, drzavaQ)) return false;
      if (mestoQ && !sadrzi(p.destinationCity, mestoQ)) return false;
      if (dobavljacQ && !sadrzi(p.supplierName, dobavljacQ)) return false;
      if (hotelQ) {
        const naziv = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '';
        if (!sadrzi(naziv, hotelQ)) return false;
      }
      if (filters.tip.length > 0 && !filters.tip.includes(p.type)) return false;
      if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;
      if (filters.drzava.length > 0 && !filters.drzava.includes(p.destinationCountry)) return false;
      if (filters.grad.length > 0 && !filters.grad.includes(p.destinationCity)) return false;
      if (filters.konekcija.length > 0 && !filters.konekcija.includes(connectionKey(p)))
        return false;
      if (q) {
        const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '';
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, filters, drzavaQ, mestoQ, hotelQ, dobavljacQ]);

  const activeCount =
    filters.tip.length +
    filters.status.length +
    filters.drzava.length +
    filters.grad.length +
    filters.konekcija.length +
    (filters.q ? 1 : 0) +
    [drzavaQ, mestoQ, hotelQ, dobavljacQ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <ProductScopeFilterBar
        action="/katalog"
        polja={SCOPE_POLJA}
        desno={
          <span className="text-[11px] text-ink-faint">
            {filtered.length} {filtered.length === 1 ? 'proizvod' : 'proizvoda'}
            {activeCount > 0 && <> od ukupno {products.length}</>}
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 && (
          <p className="text-xs text-ink-faint">
            {products.length === 0
              ? 'Nema proizvoda u katalogu.'
              : 'Nijedan proizvod ne odgovara izabranim filterima.'}
          </p>
        )}
        {filtered.map((p) => {
          const name = p.translations?.find((t) => t.languageCode === 'sr')?.name ?? '(bez naziva)';
          // §7a — klik BILO GDE na karticu otvara brz pregled u desnom panelu, a ikonica
          // otvara pun zapis u novom tabu. Do sada je klik odmah odvodio sa ekrana (kartica
          // je bila `TabLink`), pa se spisak nije mogao pregledati bez stalnog vraćanja.
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                showSummary({
                  kind: 'product',
                  id: p.id,
                  name,
                  type: p.type,
                  status: p.status,
                  destinationCountry: p.destinationCountry,
                  destinationCity: p.destinationCity,
                  sourceType: p.sourceType,
                  sourceProvider: p.sourceProvider,
                  supplierName: p.supplierName,
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openTab(`/katalog/${p.id}`, name);
                }
              }}
              // Prevlačenje u „policu podsetnika" desnog panela (M17 v2.10) — funkcija koju
              // je do sada nosio `TabLink`; prelazak na klik-za-sažetak je ne sme ukloniti.
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  PANEL_ITEM_DRAG_MIME,
                  JSON.stringify({
                    key: `katalog:${p.id}`,
                    moduleId: 'katalog-nabavka',
                    label: name,
                    subtitle: `${p.type} — ${p.destinationCity}, ${p.destinationCountry}`,
                    href: `/katalog/${p.id}`,
                  }),
                );
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="cursor-pointer rounded-lg border border-border bg-panel p-4 hover:border-accent"
            >
              <div className="mb-1 flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="border-transparent bg-accent2-soft text-accent2"
                >
                  {p.type}
                </Badge>
                <span className="flex items-center gap-1.5">
                  <Badge
                    variant={p.status === 'ACTIVE' ? 'ok' : 'secondary'}
                    className={p.status === 'ACTIVE' ? '' : 'text-ink-faint'}
                  >
                    {p.status}
                  </Badge>
                  <button
                    type="button"
                    title="Otvori pun zapis proizvoda"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTab(`/katalog/${p.id}`, name);
                    }}
                    className="flex h-[22px] w-[22px] items-center justify-center rounded text-ink-faint hover:bg-sunken hover:text-accent-strong"
                  >
                    <Icon name="link-external" />
                  </button>
                </span>
              </div>
              <div className="text-sm font-medium text-ink">{name}</div>
              <div className="text-xs text-ink-faint">
                {p.destinationCity}, {p.destinationCountry}
              </div>
              {p.supplierName && (
                <div className="mt-1 text-[11px] text-ink-faint">{p.supplierName}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
