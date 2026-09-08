import { Module } from '@nestjs/common';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ContractsModule } from './contracts/contracts.module';
import { ContractPeriodsModule } from './contract-periods/contract-periods.module';
import { PricelistImportsModule } from './pricelist-imports/pricelist-imports.module';
import { CapacityModule } from './capacity/capacity.module';

// docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md
@Module({
  imports: [
    SuppliersModule,
    ContractsModule,
    ContractPeriodsModule,
    PricelistImportsModule,
    // §2.8 (8.9.2026) — kapacitet po danu, stop-sale, blokade.
    CapacityModule,
  ],
})
export class M3UgovaranjeAlotmaniModule {}
