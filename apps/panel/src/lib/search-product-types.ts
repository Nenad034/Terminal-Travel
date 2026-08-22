// Deljeno između SearchSidebarPanel.tsx (ikonice, okidač popup-a) i SearchCriteriaChip.tsx
// (sažetak aktivne pretrage, "izmeni") — dizajn dok. §5b tabela, devet ikonica po vrsti
// turističkog proizvoda. Jedan izvor istine da se lista ne razilazi između dva mesta.
export interface ProductIconDef {
  label: string;
  icon: string;
  types: string[];
  locked?: string;
}

export const PRODUCT_ICONS: ProductIconDef[] = [
  { label: 'Smeštaj', icon: 'home', types: ['ACCOMMODATION'] },
  { label: 'Letovi', icon: 'rocket', types: ['FLIGHT'] },
  { label: 'Transferi', icon: 'arrow-swap', types: ['TRANSFER'] },
  { label: 'Rent-a-car', icon: 'milestone', types: ['TRANSPORT'] },
  { label: 'Things to do', icon: 'compass', types: ['EXCURSION', 'EVENT', 'TICKET'] },
  { label: 'Individualni paketi', icon: 'map', types: [], locked: 'Itinerar builder još nije izgrađen (M5 spec §3.0d.5)' },
  { label: 'Grupni paketi', icon: 'gift', types: ['PACKAGE'] },
  { label: 'Krstarenja', icon: 'globe', types: ['CRUISE'] },
  { label: 'Putno osiguranje', icon: 'shield', types: ['INSURANCE'] },
];

/** Nalazi definiciju čiji se `types` skup TAČNO poklapa sa zadatim (bez obzira na redosled). */
export function findIconByTypes(types: string[]): ProductIconDef | undefined {
  return PRODUCT_ICONS.find((p) => p.types.length === types.length && p.types.every((t) => types.includes(t)));
}
