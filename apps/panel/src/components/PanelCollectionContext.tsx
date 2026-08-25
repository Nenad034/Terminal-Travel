'use client';

import { createContext, useContext, useState } from 'react';

// M17 spec v2.10 — generička "polica podsetnika" u desnom panelu, za module VAN M5 pretrage
// (koja ima svoju posebnu, nepromenjenu SelectionContext.tsx svrhu — kreiranje ponude). Ovde
// stavka nema poslovnu akciju u ovom prolazu, samo prikaz+link; namerno minimalan oblik.
export interface PanelCollectionItem {
  key: string;
  moduleId: string;
  label: string;
  subtitle?: string;
  href?: string;
}

// Sopstven MIME tip za HTML5 drag-and-drop payload (TabLink.tsx → RightPanel.tsx) — izbegava
// sudar sa eventualnim tuđim drag izvorima (npr. prevlačenje teksta/fajlova iz OS-a).
export const PANEL_ITEM_DRAG_MIME = 'application/x-tt-panel-item';

interface PanelCollectionContextValue {
  itemsByModule: Record<string, PanelCollectionItem[]>;
  addItem: (item: PanelCollectionItem) => void;
  removeItem: (moduleId: string, key: string) => void;
  removeItems: (moduleId: string, keys: string[]) => void;
  clearModule: (moduleId: string) => void;
}

const PanelCollectionContext = createContext<PanelCollectionContextValue | null>(null);

// `onFirstAdd(moduleId)` otvara desni panel ZA TAJ MODUL (Shell.tsx) — isti "pojavljuje se
// prema potrebi" princip kao SelectionContext.tsx, sad po modulu (v2.10).
export function PanelCollectionProvider({
  children,
  onFirstAdd,
}: {
  children: React.ReactNode;
  onFirstAdd?: (moduleId: string) => void;
}) {
  const [itemsByModule, setItemsByModule] = useState<Record<string, PanelCollectionItem[]>>({});

  function addItem(item: PanelCollectionItem) {
    setItemsByModule((prev) => {
      const existing = prev[item.moduleId] ?? [];
      if (existing.some((i) => i.key === item.key)) return prev;
      if (existing.length === 0) onFirstAdd?.(item.moduleId);
      return { ...prev, [item.moduleId]: [...existing, item] };
    });
  }
  function removeItem(moduleId: string, key: string) {
    setItemsByModule((prev) => ({ ...prev, [moduleId]: (prev[moduleId] ?? []).filter((i) => i.key !== key) }));
  }
  function removeItems(moduleId: string, keys: string[]) {
    const keySet = new Set(keys);
    setItemsByModule((prev) => ({ ...prev, [moduleId]: (prev[moduleId] ?? []).filter((i) => !keySet.has(i.key)) }));
  }
  function clearModule(moduleId: string) {
    setItemsByModule((prev) => ({ ...prev, [moduleId]: [] }));
  }

  return (
    <PanelCollectionContext.Provider value={{ itemsByModule, addItem, removeItem, removeItems, clearModule }}>
      {children}
    </PanelCollectionContext.Provider>
  );
}

export function usePanelCollection() {
  const ctx = useContext(PanelCollectionContext);
  if (!ctx) throw new Error('usePanelCollection mora biti unutar PanelCollectionProvider');
  return ctx;
}
