'use client';

import { createContext, useContext, useState } from 'react';

// M5 spec v1.82 (29.8.2026, na zahtev vlasnika: "omogućite čuvanje i grupnih pretraga") — čisto
// klijentsko, SESIJSKO stanje (isti princip kao SelectionContext) koje pamti pojedinačne
// pretrage "u izgradnji" DOK korisnik menja `type[]`/kriterijume kroz više navigacija na istoj
// ruti (`/rezervacije/pretraga?...`) — mora živeti IZNAD same stranice (Shell.tsx) jer stranica
// je server komponenta koja se u potpunosti ponovo renderuje pri svakoj promeni query stringa.
// Kad korisnik sačuva grupu (SearchCriteriaChip.tsx), ovaj niz se upisuje u M1 `UserPreference`
// (ključ `saved_views.rezervacije_grupna_pretraga`) i prazni za sledeću grupu.
export interface StagedSearch {
  id: string;
  label: string;
  filters: Record<string, string | string[]>;
}

interface GroupSearchBuilderValue {
  staged: StagedSearch[];
  stage: (search: StagedSearch) => void;
  unstage: (id: string) => void;
  clear: () => void;
}

const GroupSearchBuilderContext = createContext<GroupSearchBuilderValue | null>(null);

export function GroupSearchBuilderProvider({ children }: { children: React.ReactNode }) {
  const [staged, setStaged] = useState<StagedSearch[]>([]);

  function stage(search: StagedSearch) {
    setStaged((prev) => [...prev, search]);
  }
  function unstage(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }
  function clear() {
    setStaged([]);
  }

  return <GroupSearchBuilderContext.Provider value={{ staged, stage, unstage, clear }}>{children}</GroupSearchBuilderContext.Provider>;
}

export function useGroupSearchBuilder() {
  const ctx = useContext(GroupSearchBuilderContext);
  if (!ctx) throw new Error('useGroupSearchBuilder mora biti unutar GroupSearchBuilderProvider');
  return ctx;
}
