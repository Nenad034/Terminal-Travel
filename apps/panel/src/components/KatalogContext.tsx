'use client';

import { createContext, useContext, useState } from 'react';
import type { Product } from '@/app/(app)/katalog/KatalogCatalog';

// Isti razlog i ista pozicija u Shell.tsx kao `SearchStateContext`/`SearchFiltersContext`
// (4.9.2026, na zahtev vlasnika: "ove filtere stavite u levi panel kao sto smo uradili kod
// pretrage") — filter UI se seli u `Sidebar.tsx`, ali podatke (listu proizvoda, iz kojih se
// izvode dinamični spiskovi država/gradova/konekcija) učitava stranica `/katalog` (server
// komponenta), koja je van Sidebar-ovog dela stabla. Provider mora stajati IZNAD oba (Shell.tsx)
// da bi oba mogla da ga čitaju/pišu — stranica upisuje listu preko `setProducts`, Sidebar panel
// je čita preko `useKatalog()`.
interface KatalogContextValue {
  products: Product[];
  setProducts: (products: Product[]) => void;
}

const Ctx = createContext<KatalogContextValue | null>(null);

export function KatalogProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  return <Ctx.Provider value={{ products, setProducts }}>{children}</Ctx.Provider>;
}

export function useKatalog() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useKatalog mora biti unutar KatalogProvider');
  return ctx;
}
