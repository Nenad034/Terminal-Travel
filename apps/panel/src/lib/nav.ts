// Namerno BEZ importa iz './me' — ovaj fajl je i klijentski (Shell/Sidebar/TopBar/
// CommandPalette čitaju NAV_ITEMS/NAV_GROUPS), a './me' uvozi 'server-only'. Filtriranje po
// dozvolama (visibleNavItems) živi u './nav-visible' (server-only), ne ovde.

export interface NavItem {
  id: string;
  label: string;
  icon: string; // Codicon naziv, docs/analize/29-DIZAJN-SISTEM-UI.md §3a
  href: string;
  /** null = uvek vidljivo kad je implementirano (npr. dashboard); inače M1 model prava (§3). */
  permission: { module: string; resource: string; action: string } | null;
  /** M17 spec §4 tabela — faza kad sekcija dolazi na red. */
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Ovaj prolaz implementira samo Fazu 0/1 — ostalo je "zaključano" u bočnoj traci (§7). */
  implemented: boolean;
}

// M17 spec §4 — kompletna tabela (svih faza), tako da se zaključane stavke već vide u
// navigaciji sa oznakom faze (spec §4/§7: "moduli koji još nisu implementirani prikazuju
// se zaključani sa oznakom faze", ne potpuno odsutni).
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'pocetna',
    label: 'Početna',
    icon: 'home',
    href: '/',
    permission: null,
    phase: 0,
    implemented: true,
  },
  {
    id: 'korisnici',
    label: 'Korisnici i uloge',
    icon: 'account',
    href: '/korisnici',
    permission: { module: 'M1', resource: 'user', action: 'VIEW' },
    phase: 0,
    implemented: true, // M1 spec §7 — lista/detalj/uloge/pojedinačni izuzeci, dopunjeno 29.8.2026
  },
  {
    id: 'audit-log',
    label: 'Audit log',
    icon: 'history',
    href: '/audit-log',
    permission: { module: 'M1', resource: 'audit-log', action: 'VIEW' },
    phase: 0,
    implemented: true,
  },
  {
    // M1 spec dopuna (6.9.2026, vlasnikov zahtev: "TT moze da ima vise ili jednu poslovnicu i
    // to treba omoguciti podesavanjima na globalnom nivou aplikacije") — prvi ekran globalnih
    // podešavanja u panelu; gate preko `branch/EDIT` (nema posebnu VIEW dozvolu u katalogu,
    // vidi napomenu u `prisma/seed/seed.ts`) — isti krug (Vlasnik/Direktor) kao samo upravljanje.
    id: 'poslovnice',
    label: 'Poslovnice',
    icon: 'organization',
    href: '/podesavanja/poslovnice',
    permission: { module: 'M1', resource: 'branch', action: 'EDIT' },
    phase: 0,
    implemented: true,
  },
  {
    id: 'katalog',
    label: 'Katalog proizvoda',
    icon: 'package',
    href: '/katalog',
    permission: { module: 'M2', resource: 'product', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    // M2 spec §2.1c (dopuna 5.9.2026) — CRUD nad DestinationProfile (tip destinacije +
    // aktivnosti), backend gotov (commit 351b2fd); ovo je prvi panel prikaz nad njim.
    id: 'destinacije',
    label: 'Profili destinacija',
    icon: 'globe',
    href: '/katalog/destinacije',
    permission: { module: 'M2', resource: 'destination-profile', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    id: 'dobavljaci',
    label: 'Dobavljači i ugovori',
    icon: 'briefcase',
    href: '/dobavljaci',
    permission: { module: 'M3', resource: 'supplier', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    id: 'pretraga',
    label: 'Pretraga i rezervacije',
    icon: 'search',
    href: '/rezervacije/pretraga',
    permission: { module: 'M5', resource: 'booking', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    id: 'kalendar',
    label: 'Kalendar rezervacija',
    icon: 'calendar',
    href: '/rezervacije/kalendar',
    permission: { module: 'M5', resource: 'booking', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    // STVARNA lista od M5 spec v1.54 (24.8.2026) — zove pravi `GET /sales/bookings` sa pravim
    // filterima. "(mock)" uklonjeno iz naziva; par polja na samom ekranu (zvonce, kontakt,
    // poslovnica, naziv hotela) i dalje su vizuelno-demo bez pravog izvora, obeleženo na ekranu.
    id: 'rezervacije-lista',
    label: 'Lista rezervacija',
    icon: 'list-unordered',
    href: '/rezervacije/lista',
    permission: { module: 'M5', resource: 'booking', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    // M5 spec §8 (5.9.2026) — ekran za operativne liste i najave izmene/storna. Pozadinska
    // logika postoji od avgusta 2026, ali do danas nije imala nijedan ulaz iz panela: funkcija
    // je postojala u kodu i praktično ne za operatera („logika postoji, UI ne", CLAUDE.md).
    id: 'rezervacije-najave',
    label: 'Najave dobavljačima',
    icon: 'mail',
    href: '/rezervacije/najave',
    permission: { module: 'M5', resource: 'supplier-manifest', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    id: 'finansije',
    label: 'Finansije',
    icon: 'credit-card',
    href: '/finansije',
    permission: { module: 'M10', resource: 'fiscal-document', action: 'VIEW' },
    phase: 2,
    implemented: true,
  },
  {
    // Dodato 6.9.2026 na zahtev vlasnika. Do tada su `GET`/`POST /finance/exchange-rates`
    // postojali BEZ ijednog ekrana — kurs se nije mogao ni videti ni ručno uneti kroz
    // interfejs. Vidi M10 spec §3.1a.
    id: 'kursna-lista',
    label: 'Kursna lista',
    icon: 'graph',
    href: '/finansije/kursna-lista',
    permission: { module: 'M10', resource: 'exchange-rate', action: 'VIEW' },
    phase: 2,
    implemented: true,
  },
  {
    id: 'compliance',
    label: 'Compliance (garancija putovanja)',
    icon: 'shield',
    href: '/compliance',
    permission: { module: 'M11', resource: 'travel-guarantee', action: 'VIEW' },
    phase: 2,
    implemented: true,
  },
  {
    id: 'ugovori-klijenti',
    label: 'Ugovori sa klijentima',
    icon: 'file-text',
    href: '/ugovori-klijenti',
    permission: { module: 'M20', resource: 'client-contract', action: 'VIEW' },
    phase: 2,
    implemented: true,
  },
  {
    id: 'crm',
    label: 'Gosti i nalogodavci (CRM)',
    icon: 'organization',
    href: '/crm',
    permission: { module: 'M6', resource: 'client-account', action: 'VIEW' },
    phase: 3,
    implemented: true,
  },
  {
    id: 'b2b',
    label: 'B2B partneri',
    icon: 'plug',
    href: '/b2b',
    permission: { module: 'M7', resource: 'subagent', action: 'VIEW' },
    phase: 4,
    implemented: true,
  },
  {
    id: 'izvestaji',
    label: 'Izveštaji',
    icon: 'graph-line',
    href: '/izvestaji',
    permission: { module: 'M13', resource: 'report:sales', action: 'VIEW' },
    phase: 5,
    implemented: true,
  },
  {
    id: 'podrska',
    label: 'Podrška',
    icon: 'question',
    href: '/podrska',
    permission: { module: 'M14', resource: 'ticket', action: 'VIEW' },
    phase: 5,
    implemented: true,
  },
  {
    id: 'marketing',
    label: 'Marketing sadržaj',
    icon: 'megaphone',
    href: '/marketing',
    permission: { module: 'M12', resource: 'content', action: 'VIEW' },
    phase: 6,
    implemented: true,
  },
  {
    id: 'nadzor',
    label: 'Operativni nadzor',
    icon: 'pulse',
    href: '/nadzor',
    permission: { module: 'M18', resource: 'health-signal', action: 'VIEW' },
    phase: 7,
    implemented: true,
  },
  {
    id: 'chat',
    label: 'Razgovori (tim/dobavljači)',
    icon: 'comment-discussion',
    href: '/chat',
    permission: { module: 'M19', resource: 'conversation', action: 'VIEW' },
    phase: 7,
    implemented: true,
  },
  {
    id: 'pomoc',
    label: 'Centar za pomoć',
    icon: 'mortar-board',
    href: '/pomoc',
    permission: { module: 'M21', resource: 'article:staff', action: 'VIEW' },
    phase: 7,
    implemented: true,
  },
  {
    id: 'email',
    label: 'Email/Inbox',
    icon: 'mail',
    href: '/email',
    permission: { module: 'M22', resource: 'email-thread', action: 'VIEW' },
    phase: 7,
    implemented: true,
  },
  {
    id: 'znanje',
    label: 'Znanje (destinacije/proizvodi)',
    icon: 'compass',
    href: '/znanje',
    permission: { module: 'M23', resource: 'article', action: 'VIEW' },
    phase: 7,
    implemented: true,
  },
  {
    id: 'mcp',
    label: 'MCP klijenti (agentski pristup)',
    icon: 'radio-tower',
    href: '/mcp',
    permission: { module: 'M16', resource: 'mcp-client', action: 'VIEW' },
    phase: 6,
    implemented: true,
  },
  {
    // Dopuna (23.8.2026, na zahtev vlasnika: "Kada se klikne na settings dugme u levom panelu
    // treba da se pojave sve live api konekcije sa nazivom statusom i health check statusom")
    // — spaja postojeći M4 `GET /integrations/providers` (naziv/konfiguracioni status) sa
    // postojećim M18 `GET /ops/provider-health` (health-check status/latencija/uptime) u jedan
    // ekran; oba endpoint-a već postoje, ovo je prvi panel prikaz koji ih objedinjuje.
    id: 'integracije',
    label: 'API konekcije',
    icon: 'pulse',
    href: '/integracije',
    permission: { module: 'M18', resource: 'provider-health', action: 'VIEW' },
    phase: 4,
    implemented: true,
  },
];

export interface NavGroup {
  id: string;
  label: string;
  icon: string; // Codicon naziv, docs/analize/29-DIZAJN-SISTEM-UI.md §3a.1
  itemIds: string[];
}

/**
 * M17 spec §4a — 17 sekcija grupisano u 8 kategorija + samostalna Početna, da gornja
 * traka nosi 9 ikona umesto 17 (docs/analize/29-DIZAJN-SISTEM-UI.md §5c). Administracija je
 * namerno na suprotnom kraju trake od ostalih (isti princip kao VS Code zupčanik za
 * podešavanja) — ovaj niz ostaje u tom redosledu, `TopBar` je ne sme sam preslagivati.
 */
export const NAV_GROUPS: NavGroup[] = [
  { id: 'pocetna', label: 'Početna', icon: 'home', itemIds: ['pocetna'] },
  // `icon: 'euro'` (5.9.2026, vlasnikov zahtev: "umesto ikone lupe... stavite ikonu za EUR") —
  // rezervisano ime bez sopstvenog Codicon glifa, `Icon.tsx` ga posebno tretira (prikazuje "€").
  { id: 'prodaja', label: 'Prodaja', icon: 'euro', itemIds: ['pretraga', 'kalendar', 'rezervacije-lista', 'rezervacije-najave'] },
  { id: 'katalog-nabavka', label: 'Katalog i nabavka', icon: 'package', itemIds: ['katalog', 'destinacije', 'dobavljaci'] },
  { id: 'klijenti-partneri', label: 'Klijenti i partneri', icon: 'organization', itemIds: ['crm', 'b2b'] },
  { id: 'finansije-pravno', label: 'Finansije i pravno', icon: 'law', itemIds: ['finansije', 'kursna-lista', 'compliance', 'ugovori-klijenti'] },
  { id: 'komunikacija-podrska', label: 'Komunikacija i podrška', icon: 'comment-discussion', itemIds: ['podrska', 'chat', 'pomoc', 'email'] },
  { id: 'sadrzaj-znanje', label: 'Sadržaj i znanje', icon: 'book', itemIds: ['marketing', 'znanje'] },
  { id: 'analitika-nadzor', label: 'Analitika i nadzor', icon: 'graph-line', itemIds: ['izvestaji', 'nadzor'] },
  { id: 'administracija', label: 'Administracija', icon: 'settings-gear', itemIds: ['korisnici', 'poslovnice', 'audit-log', 'mcp', 'integracije'] },
];

function itemForHref(href: string): NavItem | null {
  return NAV_ITEMS.find((i) => i.href === href || (i.href !== '/' && href.startsWith(i.href))) ?? null;
}

/** Grupa kojoj pripada data ruta — koristi se za podrazumevanu aktivnu grupu pri učitavanju. */
export function groupForHref(href: string): NavGroup | null {
  const item = itemForHref(href);
  if (!item) return null;
  return NAV_GROUPS.find((g) => g.itemIds.includes(item.id)) ?? null;
}

/** M15 module_code trenutne sekcije (npr. "M5") — null za sekcije bez modula (Početna) ili
 * bez poklapanja. Koristi donja traka (dizajn dok. §5d, "AI status po trenutnom modulu"). */
export function moduleCodeForHref(href: string): string | null {
  return itemForHref(href)?.permission?.module ?? null;
}
