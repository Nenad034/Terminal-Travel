/**
 * Keš za JEDAN prolaz rekonsilijacije (5.9.2026, dok. 39 nalaz 2.3).
 *
 * ZAŠTO POSTOJI: `buildFactBookingData` za svaku stavku rezervacije povlači proizvod, ugovor,
 * dobavljača, klijentski nalog, subagenta i kurs. Ti podaci se **ogromno ponavljaju** — hiljadu
 * stavki jednog hotela znači hiljadu identičnih upita za tog istog dobavljača. Rekonsilijacija
 * je obrađivala stavku po stavku bez ikakvog pamćenja, pa je broj upita rastao pravolinijski sa
 * brojem stavki.
 *
 * ŠTA OVO NIJE: nije keš koji živi između poziva. Pravi se na početku jednog prolaza i baca se
 * na kraju — inače bi rekonsilijacija, čiji je ceo posao da uhvati promene u izvornim modulima,
 * čitala zastarele podatke i „ispravljala" projekciju na staru vrednost. Zato se namerno ne
 * uvodi ni globalni keš ni TTL: kratak život je ovde osobina, ne ograničenje.
 */
export class FactSyncCache {
  private readonly spaces = new Map<string, Map<string, unknown>>();

  /** Vraća iz keša ili učita jednom i zapamti. `null`/`undefined` se takođe pamte (i to je odgovor). */
  async get<T>(space: string, key: string, load: () => Promise<T>): Promise<T> {
    let bucket = this.spaces.get(space);
    if (!bucket) {
      bucket = new Map<string, unknown>();
      this.spaces.set(space, bucket);
    }
    if (bucket.has(key)) return bucket.get(key) as T;
    const value = await load();
    bucket.set(key, value);
    return value;
  }

  /** Broj zapamćenih vrednosti — koristi se u logu rekonsilijacije da se vidi da keš stvarno radi. */
  size(): number {
    let n = 0;
    for (const bucket of this.spaces.values()) n += bucket.size;
    return n;
  }
}
