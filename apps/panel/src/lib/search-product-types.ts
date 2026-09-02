// Deljeno između ekrana pretrage (SearchProductTabs.tsx — ikonice u centralnom panelu),
// SearchCriteriaChip.tsx (sažetak aktivne pretrage) i SearchSidebarPanel.tsx (filteri po
// aktivnoj vrsti) — M5 spec §3.0g.1, dizajn dok. §6d.1. Jedan izvor istine da se lista ne
// razilazi između mesta.
export interface ProductIconDef {
  label: string;
  icon: string;
  types: string[];
  /**
   * Vrsta proizvoda koja danas nema NIJEDAN izvor podataka iza sebe (nema ugovor u M3 niti
   * provajdera u M4) — M5 spec §3.0g.5. Ikonica se svejedno postavlja (vlasnikova odluka), ali
   * prazan rezultat dobija OVU rečenicu umesto gole "nema rezultata" poruke: prazna lista uči
   * korisnika da je aplikacija pokvarena, rečenica ga uči da posao tek dolazi (ista zamka 3.1
   * iz `33-ZAMKE-I-OBAVEZNE-PROVERE.md`, samo primenjena unapred na ekranu).
   *
   * Poruka se prikazuje ISKLJUČIVO kad pretraga stvarno vrati nula rezultata — čim se izvor
   * pojavi i vrati ponude, prikazuju se ponude i ovo polje prestaje da išta znači samo od sebe.
   * Namerno: statična lista "šta još nema izvor" ovako ne može tiho da zastari (upravo to se
   * desilo sa tvrdnjom da `CRUISE` ne postoji u `ProductType` enumu — vrednost je dodata
   * 21.8.2026, commit 8a52578, a spec je 2.9.2026 i dalje tvrdio suprotno).
   */
  emptyMessage?: string;
  /**
   * Vrsta koja nema ni sopstveni ekran, ne samo izvor podataka — klik ne pokreće pretragu.
   * Danas samo "Individualni paketi" (otvara nacrt putovanja, M5 spec §3.0d.5, ekran ne postoji).
   */
  locked?: string;
}

export const PRODUCT_ICONS: ProductIconDef[] = [
  { label: 'Smeštaj', icon: 'home', types: ['ACCOMMODATION'] },
  { label: 'Letovi', icon: 'rocket', types: ['FLIGHT'] },
  { label: 'Transferi', icon: 'arrow-swap', types: ['TRANSFER'] },
  {
    label: 'Rent-a-car',
    icon: 'milestone',
    types: ['TRANSPORT'],
    emptyMessage: 'Rent-a-car još nema ugovorene ponude — nijedan ugovor (M3) ni provajder (M4) još ne pokriva ovu vrstu.',
  },
  { label: 'Things to do', icon: 'compass', types: ['EXCURSION', 'EVENT', 'TICKET'] },
  { label: 'Individualni paketi', icon: 'map', types: [], locked: 'Itinerar builder još nije izgrađen (M5 spec §3.0d.5)' },
  {
    label: 'Grupni paketi',
    icon: 'gift',
    types: ['PACKAGE'],
    emptyMessage: 'Grupni paketi još nemaju ugovorene ponude — nijedan ugovor (M3) ni provajder (M4) još ne pokriva ovu vrstu.',
  },
  {
    label: 'Krstarenja',
    icon: 'globe',
    types: ['CRUISE'],
    emptyMessage: 'Krstarenja još nemaju ugovorene ponude — nijedan ugovor (M3) ni provajder (M4) još ne pokriva ovu vrstu.',
  },
  {
    label: 'Putno osiguranje',
    icon: 'shield',
    types: ['INSURANCE'],
    emptyMessage: 'Putno osiguranje još nema ugovorene ponude — nijedan ugovor (M3) ni provajder (M4) još ne pokriva ovu vrstu.',
  },
];

/** Nalazi definiciju čiji se `types` skup TAČNO poklapa sa zadatim (bez obzira na redosled). */
export function findIconByTypes(types: string[]): ProductIconDef | undefined {
  return PRODUCT_ICONS.find((p) => p.types.length > 0 && p.types.length === types.length && p.types.every((t) => types.includes(t)));
}
