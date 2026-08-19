import { Me, hasPermission } from './me';
import { NAV_ITEMS, type NavItem } from './nav';

/**
 * Navigacija filtrirana na ulogu (M17 spec §3, §5.5) — koristi je i bočna traka i
 * komandna paleta (prazan upit + Enter, docs/analize/29-DIZAJN-SISTEM-UI.md §4) iz istog
 * izvora, kako spec §5.5 zahteva ("isti filter kao levi meni"). Stavke bez implementacije
 * ostaju u listi (zaključane), stavke bez dozvole se u potpunosti uklanjaju (§3 — "ne samo
 * da je onemogućen", da interfejs ne otkrije postojanje podataka kojima korisnik ne sme
 * da pristupi).
 *
 * Namerno u sopstvenom fajlu (ne u ./nav) — zavisi od './me' (server-only), a ./nav čitaju
 * i klijentske shell komponente za NAV_ITEMS/NAV_GROUPS. Poziva se isključivo iz server
 * komponenti (npr. (app)/layout.tsx), rezultat (NavItem[]) se dalje prosleđuje klijentu.
 */
export function visibleNavItems(me: Me | null): NavItem[] {
  return NAV_ITEMS.filter((item) => item.permission === null || hasPermission(me, item.permission.module, item.permission.resource, item.permission.action));
}
