/**
 * Čekanje na asinhroni ishod u e2e testovima — anketiranjem, ne fiksnim brojem milisekundi.
 *
 * Event Bus radi preko Postgres `LISTEN/NOTIFY`, dakle van zahteva koji ga je pokrenuo. Test koji
 * posle emitovanja događaja odspava fiksnih 500 ms daje dva loša ishoda odjednom: na sporijoj
 * mašini padne iako je kod ispravan (izmereno 10.9.2026 — isti test pao u punom paketu, prošao
 * sam), a na brzoj troši vreme koje mu ne treba. Oba nestaju kad se čeka na **uslov**.
 *
 * `najduze` je gornja granica, ne očekivano trajanje: kad posao stigne za 40 ms, čeka se 40 ms.
 */
export async function sacekajDa<T>(
  proveri: () => Promise<T | null | undefined | false>,
  opcije: { opis: string; najduze?: number; korak?: number },
): Promise<T> {
  const { opis, najduze = 15000, korak = 50 } = opcije;
  const kraj = Date.now() + najduze;
  let poslednjaGreska: unknown = null;

  for (;;) {
    try {
      const rezultat = await proveri();
      if (rezultat) return rezultat;
    } catch (greska) {
      poslednjaGreska = greska;
    }
    if (Date.now() >= kraj) {
      const dodatak = poslednjaGreska ? ` Poslednja greška: ${String(poslednjaGreska)}` : '';
      throw new Error(`Isteklo ${najduze} ms čekanja da ${opis}.${dodatak}`);
    }
    await new Promise((resolve) => setTimeout(resolve, korak));
  }
}
