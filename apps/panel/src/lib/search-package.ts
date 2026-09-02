// Individualni paket na ekranu pretrage — M5 spec §3.0d.5 / §3.0d.5a.
//
// Paket NIJE vrsta proizvoda i NIJE poseban ekran (§3.0d.5). Vlasnikova odluka (3.9.2026, posle
// prvog, složenijeg pokušaja sa trakom koraka): klik na „Individualni paketi" znači **samo jedno
// — sledeća usluga preuzima datum prethodne**. Sve ostalo ostaje tačno kako već radi: ideš
// ikonicu po ikonicu, koristiš iste forme pretrage, i dodaješ stavku po stavku u desni panel,
// koji ih već sabira (§3.0e.3) i pravi Ponudu.
//
// Prvi pokušaj je uz to imao traku koraka sa unapred obeleženim uslugama i pomerajem u danima.
// Odbačen je jer je **udvajao red ikonica** (dva mesta za isti izbor) i terao korisnika da
// odluči sastav paketa pre nego što je išta pretražio. Zapisano ovde da se ne vrati.

/** „Paket" je jedan prekidač u adresi, ne skup koraka. */
export function isPackageMode(sp: { get(key: string): string | null }): boolean {
  return sp.get('paket') === '1';
}

/** ISO datum pomeren za `days` dana; prazan ulaz vraća prazan izlaz. */
export function shiftDate(iso: string, days: number): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`); // podne — pomeraj ne sme da padne na promenu vremenske zone
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Datum koji nova pretraga nasleđuje od poslednje stavke u selekciji (§3.0d.5a).
 *
 * „Prethodni segment" je **poslednja stavka dodata u desni panel** — bez propisanog redosleda
 * koraka to je jedino značenje koje se poklapa sa onim što korisnik stvarno radi: doda let, pa
 * otvori smeštaj i datum je već tu.
 *
 * Nasleđuje se KRAJ prethodne stavke (odlazak iz hotela, dolet), a ne početak — sledeća usluga
 * počinje kad se prethodna završi. Jednodnevna stavka (let) nema kraj različit od početka, pa se
 * uzima isti dan.
 */
export function inheritedStayFrom(last: { stayFrom?: string; stayTo?: string } | undefined): string {
  if (!last) return '';
  return last.stayTo || last.stayFrom || '';
}
