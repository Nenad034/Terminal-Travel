import { apiFetch } from '@/lib/api-client';
import { getMe, hasPermission } from '@/lib/me';
import RegisterTab from '@/components/RegisterTab';
import Icon from '@/components/Icon';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import KatalogCatalog, { type Product } from './KatalogCatalog';

// M17 spec §4/§7 (Faza 1) — "tim može ručno da unese proizvod (M2)". Lista poziva
// GET /catalog/products (interni kanal M17, uključuje source_* polja, M2 spec §7).
//
// Filteri (4.9.2026, na zahtev vlasnika: "uvesti filtere po vrsti proizvoda, drzavi,
// destinaciji, konekciji") — kompletna lista se povlači JEDNOM, filtriranje ide u
// `KatalogCatalog.tsx` nad već dobijenim podacima (isti princip kao filteri u
// `SearchSidebarPanel.tsx`, M5 §3.0g.1: trenutno, klijentsko, bez novog poziva serveru).
// Interni katalog realno ima na desetine/stotine, ne desetine hiljada zapisa — nema razloga
// za server-side paginaciju/filtriranje, backend API ugovor (spec §7) ostaje nepromenjen.
// Stanje filtera se ipak upisuje u adresu (`?tip=...&drzava=...`) da pogled bude deljiv/
// bookmark-ovan, isto očekivanje kao Audit log i Lista rezervacija.
export default async function KatalogPage() {
  const me = await getMe();
  const canCreate = hasPermission(me, 'M2', 'product', 'CREATE');

  let products: Product[] = [];
  let error: string | null = null;
  try {
    // Odgovor je od 5.9.2026 `{ data, total, ... }` (dok. 39 nalaz 2.2). Bez `page`/`limit`
    // i dalje stižu SVI proizvodi — filteri ispod rade nad celom listom, v. komentar iznad.
    const page = await apiFetch<{ data: Product[]; total: number }>('/catalog/products');
    products = page.data;
  } catch {
    error = 'Nemate dozvolu za uvid u katalog (M2/product/VIEW).';
  }

  return (
    <div className="p-6">
      <RegisterTab label="Katalog proizvoda" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg">
            <span className="text-accent">$</span> ls katalog/
          </h1>
          <p className="text-xs text-ink-dim">Svi proizvodi (ugovoreni i API), bez obzira na izvor.</p>
        </div>
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/katalog/novi" className="flex items-center gap-1.5">
              <Icon name="add" /> novi proizvod
            </Link>
          </Button>
        )}
      </div>

      {error && <p className="rounded bg-danger-bg p-3 text-sm text-danger">{error}</p>}

      {!error && <KatalogCatalog products={products} />}
    </div>
  );
}
