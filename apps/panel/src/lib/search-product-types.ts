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
   * Danas nijedna; polje ostaje jer je "ikonica postoji, ekran ne" stanje koje se ponavlja.
   */
  locked?: string;
  /**
   * Ikonica koja ne pokreće pretragu nego uključuje SASTAVLJANJE paketa (M5 spec §3.0d.5a) —
   * ostale ikonice tada menjaju značenje u "ova usluga ulazi u paket". Samo "Individualni
   * paketi"; paket nije `Product.type` (§3.0d.5), zato mu `types` i ostaje prazan.
   */
  packageMode?: boolean;
  /**
   * M2 spec §2.3f / M5 spec §3.0d.6b (dopuna 5.9.2026) — samo "Putovanja": isti
   * `Product.type = PACKAGE` kao "Grupni paketi" (koje ovo polje nema), razdvojeno upitnim
   * parametrom `hasExpertGuide`, ne novim tipom — isti obrazac kao "Rent-a-car" pod `TRANSPORT`.
   * `urlFor` dodaje `hasExpertGuide=true` u adresu kad je postavljeno; `findIconByTypes` zahteva
   * poklapanje i po `types` i po ovom polju, da dva taba sa istim `types` nizom ostanu razdvojiva.
   */
  hasExpertGuide?: boolean;
  /**
   * Prikaži `icon` DVA PUTA, blago preklopljeno (`Icon.tsx` → `IconDuo`), umesto jednom —
   * `@vscode/codicons` nema jedinstven glif za "grupu ljudi", samo `person` za jednu osobu.
   * Dodato 5.9.2026 na vlasnikov zahtev ("stavite dve ikone čoveka jer je putovanje grupno").
   */
  iconDuo?: boolean;
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
  { label: 'Individualni paketi', icon: 'map', types: [], packageMode: true },
  {
    label: 'Grupni paketi',
    icon: 'gift',
    types: ['PACKAGE'],
    emptyMessage: 'Grupni paketi još nemaju ugovorene ponude — nijedan ugovor (M3) ni provajder (M4) još ne pokriva ovu vrstu.',
  },
  {
    // `codicon-flag` NE POSTOJI u stvarnom @vscode/codicons setu (izmišljeno 5.9.2026, ispravljeno
    // istog dana kad je vlasnik prijavio da se ikonica ne prikazuje) — `person` predstavlja
    // stručnog vodiča koji putovanje razlikuje od običnog "Grupnog paketa".
    label: 'Putovanja',
    icon: 'person',
    iconDuo: true,
    types: ['PACKAGE'],
    hasExpertGuide: true,
    emptyMessage: 'Putovanja sa vodičem još nemaju ugovorene ponude — nijedan ugovor (M3) ni provajder (M4) još ne pokriva ovu vrstu.',
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

/**
 * Nalazi definiciju čiji se `types` skup TAČNO poklapa sa zadatim (bez obzira na redosled), I
 * čiji `hasExpertGuide` fleg odgovara — bez ovog drugog uslova "Grupni paketi" i "Putovanja" (isti
 * `types: ['PACKAGE']`) ne bi mogli da se razdvoje (M5 spec §3.0d.6b, dopuna 5.9.2026).
 */
export function findIconByTypes(types: string[], hasExpertGuide = false): ProductIconDef | undefined {
  return PRODUCT_ICONS.find(
    (p) => p.types.length > 0 && p.types.length === types.length && p.types.every((t) => types.includes(t)) && Boolean(p.hasExpertGuide) === hasExpertGuide,
  );
}
