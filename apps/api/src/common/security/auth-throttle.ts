/**
 * Bezbednosna analiza (dok. 36, §3 tačka 1, 28.8.2026) — stroži throttle na login/MFA/pretragu
 * nego globalni podrazumevani (100/min, `app.module.ts`). Jest AUTOMATSKI postavlja
 * `NODE_ENV=test` pre učitavanja bilo kog testa (potvrđeno uživo) — bez ovog izuzetka, e2e
 * testovi koji uzastopno prijavljuju više naloga u istom fajlu (isti IP, ista `ThrottlerGuard`
 * memorija u procesu) bi sami sebe blokirali posle par poziva i lažno prijavili grešku koja u
 * pravoj upotrebi ne postoji.
 */
const isTest = process.env.NODE_ENV === 'test';

export function throttleLimit(productionLimit: number): number {
  return isTest ? 100_000 : productionLimit;
}
