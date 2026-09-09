/**
 * Pretvaranje između onoga što čovek kuca i onoga što baza čuva.
 *
 * Iznosi se u bazi drže kao ceo broj u najmanjoj jedinici valute (M3 spec §2) — 89,50 EUR je
 * 8950. Do 9.9.2026 je taj unutrašnji format bio i na ekranu: forma za cenu nosila je natpis
 * „Cena (u najmanjoj jedinici valute ugovora)" i korisnik je kucao 8950. Vlasnik je to prijavio
 * kao nedostatak („previše zbrkano"), pa pretvaranje od sada radi kod, na jednom mestu.
 */

/** „89,50", „89.50", „89" → 8950. `null` kad unos nije iznos ili nije pozitivan. */
export function uNajmanjuJedinicu(unos: string): number | null {
  const s = unos.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100);
  return n > 0 ? n : null;
}

/** 8950 → „89,50". Bez oznake valute — nju dodaje pozivalac, jer je zna iz ugovora. */
export function izNajmanjeJedinice(iznos: number): string {
  return (iznos / 100).toLocaleString('sr-RS', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
