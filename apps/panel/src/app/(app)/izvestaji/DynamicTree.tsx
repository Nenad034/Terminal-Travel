'use client';

import { useState } from 'react';

export interface DynamicNode {
  key: string;
  count: number;
  pax: number;
  nights: number;
  revenue: number;
  paid: number;
  balance: number;
  children: DynamicNode[];
}

function formatMoney(value: number): string {
  return `${(value / 100).toLocaleString('sr-RS', { minimumFractionDigits: 2 })}`;
}

interface FlatRow {
  node: DynamicNode;
  depth: number;
  /** Puna putanja (ključevi svih predaka spojeni), NE samo `node.key` — dva čvora na različitim
   * granama mogu imati isti naziv (npr. grad "Nikšić" ispod dve različite... ne bi trebalo, ali
   * generalno dva ista naziva na različitim mestima u stablu NISU redak slučaj), pa sklapanje
   * mora biti po putanji, ne po golom nazivu. */
  path: string;
}

function flatten(nodes: DynamicNode[], depth: number, parentPath: string, collapsed: Set<string>, out: FlatRow[]) {
  for (const n of nodes) {
    const path = parentPath ? `${parentPath}›${n.key}` : n.key;
    out.push({ node: n, depth, path });
    if (n.children.length > 0 && !collapsed.has(path)) flatten(n.children, depth + 1, path, collapsed, out);
  }
}

// Sklopiv prikaz — "+"/"−" za širenje/skupljanje (5.9.2026, vlasnikov zahtev: "uvedite + i - za
// sirenje prikaza kod drzava i destinacija"). Izdvojeno u sopstven klijentski fajl (za razliku od
// ostatka `izvestaji/page.tsx`, koji je server komponenta) — sklapanje je čisto lokalno stanje
// ekrana, ne treba mu server round-trip niti se čuva u adresi (isti princip kao ranije
// prevlačenje tabova, samo ovde nema razloga da preživi osvežavanje stranice). Podrazumevano SVE
// prošireno (identično ponašanju pre ove dopune) — "+"/"−" samo DODAJE mogućnost da se sklopi,
// ne menja početni izgled.
export default function DynamicTree({ nodes }: { nodes: DynamicNode[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows: FlatRow[] = [];
  flatten(nodes, 0, '', collapsed, rows);

  function toggle(path: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="overflow-hidden overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-sunken text-[11px] uppercase tracking-wide text-ink-faint">
            <th className="px-4 py-2 text-left font-medium">naziv</th>
            <th className="px-4 py-2 text-right font-medium">rezervacija</th>
            <th className="px-4 py-2 text-right font-medium">osoba</th>
            <th className="px-4 py-2 text-right font-medium">noćenja</th>
            <th className="px-4 py-2 text-right font-medium">prihod</th>
            <th className="px-4 py-2 text-right font-medium">naplaćeno</th>
            <th className="px-4 py-2 text-right font-medium">saldo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node: n, depth, path }, i) => {
            // Boldiraj totale (5.9.2026, vlasnikov zahtev: "boldiraj totale po drzavama") — svaki
            // čvor sa decom JESTE total te grane (roditelj = zbir dece, §4.2.1); kad je prva
            // dimenzija "destination_country" (podrazumevano), ovo su tačno redovi po državi, ali
            // princip radi za BILO koju izabranu dimenziju (isti razlog kao "+"/"−" ispod).
            const isTotal = n.children.length > 0;
            const isCollapsed = collapsed.has(path);
            const numCls = `border-t border-border px-4 py-2 text-right font-mono ${isTotal ? 'font-semibold text-ink' : 'text-ink-dim'}`;
            return (
              <tr key={path} className={i % 2 === 1 ? 'bg-panel2/40' : undefined}>
                <td
                  className={`border-t border-border px-4 py-2 text-ink ${isTotal ? 'font-semibold' : 'font-medium'}`}
                  style={{ paddingLeft: 16 + depth * 16 }}
                >
                  {isTotal ? (
                    <button
                      type="button"
                      onClick={() => toggle(path)}
                      title={isCollapsed ? 'Proširi' : 'Skupi'}
                      className="mr-1.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border border-border align-middle text-[10px] font-bold leading-none text-ink-faint hover:border-accent hover:text-accent"
                    >
                      {isCollapsed ? '+' : '−'}
                    </button>
                  ) : (
                    <span className="mr-1.5 inline-block h-4 w-4" />
                  )}
                  {n.key}
                </td>
                <td className={numCls}>{n.count.toLocaleString('sr-RS')}</td>
                <td className={numCls}>{n.pax.toLocaleString('sr-RS')}</td>
                <td className={numCls}>{n.nights.toLocaleString('sr-RS')}</td>
                <td className={numCls}>{formatMoney(n.revenue)}</td>
                <td className={numCls}>{formatMoney(n.paid)}</td>
                <td className={numCls}>{formatMoney(n.balance)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
