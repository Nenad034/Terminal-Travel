/**
 * Ručno pokretanje M13 rekonsilijacije (`ReconciliationService.reconcile`) van HTTP-a.
 *
 * Zašto postoji: `POST /bi/reconciliation/run` (M13 spec §7) traži prijavljenog Vlasnika/
 * Direktora — pogodno za panel dugme, nezgodno za jednokratno lokalno osvežavanje FactBooking/
 * FactPayment projekcije posle rucnog punjenja baze (npr. mock seed skripte upisuju rezervacije
 * direktno preko Prisma-e, bez NestJS event bus-a koji inače pokreće `FactSyncService` po
 * rezervaciji — projekcija ostaje prazna dok se ne pokrene noćni posao ili ovo). Isti obrazac kao
 * `backfill-exchange-rates.ts` — održavanje, ne svakodnevni alat, ne nova funkcionalnost (poziva
 * već postojeći, spec-om pokriven servis).
 *
 * Pokretanje (iz apps/api):
 *   npx ts-node prisma/seed/run-bi-reconciliation.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { ReconciliationService } from '../../src/modules/m13-bi/reconciliation/reconciliation.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const reconciliation = app.get(ReconciliationService);
    const result = await reconciliation.reconcile();
    console.log('Rekonsilijacija završena:', result);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
