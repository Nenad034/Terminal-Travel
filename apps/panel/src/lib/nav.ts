import { Me, hasPermission } from './me';

export interface NavItem {
  id: string;
  label: string;
  icon: string; // Codicon naziv, docs/analize/29-DIZAJN-SISTEM-UI.md §3a
  href: string;
  /** null = uvek vidljivo kad je implementirano (npr. dashboard); inače M1 model prava (§3). */
  permission: { module: string; resource: string; action: string } | null;
  /** M17 spec §4 tabela — faza kad sekcija dolazi na red. */
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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
    implemented: false, // M1 ekrani nisu u obimu ovog prolaza (samo dashboard/audit-log iz §5)
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
    id: 'katalog',
    label: 'Katalog proizvoda',
    icon: 'library',
    href: '/katalog',
    permission: { module: 'M2', resource: 'product', action: 'VIEW' },
    phase: 1,
    implemented: true,
  },
  {
    id: 'dobavljaci',
    label: 'Dobavljači i ugovori',
    icon: 'file-text',
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
    id: 'finansije',
    label: 'Finansije',
    icon: 'credit-card',
    href: '/finansije',
    permission: { module: 'M10', resource: 'fiscal-document', action: 'VIEW' },
    phase: 2,
    implemented: true,
  },
  {
    id: 'compliance',
    label: 'Compliance (garancija putovanja)',
    icon: 'law',
    href: '/compliance',
    permission: { module: 'M11', resource: 'travel-guarantee', action: 'VIEW' },
    phase: 2,
    implemented: true,
  },
  {
    id: 'ugovori-klijenti',
    label: 'Ugovori sa klijentima',
    icon: 'checklist',
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
    icon: 'globe',
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
    implemented: false,
  },
  {
    id: 'podrska',
    label: 'Podrška',
    icon: 'comment-discussion',
    href: '/podrska',
    permission: { module: 'M14', resource: 'ticket', action: 'VIEW' },
    phase: 5,
    implemented: false,
  },
  {
    id: 'marketing',
    label: 'Marketing sadržaj',
    icon: 'megaphone',
    href: '/marketing',
    permission: { module: 'M12', resource: 'content', action: 'VIEW' },
    phase: 6,
    implemented: false,
  },
];

/**
 * Navigacija filtrirana na ulogu (M17 spec §3, §5.5) — koristi je i bočna traka i
 * komandna paleta (prazan upit + Enter, docs/analize/29-DIZAJN-SISTEM-UI.md §4) iz istog
 * izvora, kako spec §5.5 zahteva ("isti filter kao levi meni"). Stavke bez implementacije
 * ostaju u listi (zaključane), stavke bez dozvole se u potpunosti uklanjaju (§3 — "ne samo
 * da je onemogućen", da interfejs ne otkrije postojanje podataka kojima korisnik ne sme
 * da pristupi).
 */
export function visibleNavItems(me: Me | null): NavItem[] {
  return NAV_ITEMS.filter((item) => item.permission === null || hasPermission(me, item.permission.module, item.permission.resource, item.permission.action));
}
