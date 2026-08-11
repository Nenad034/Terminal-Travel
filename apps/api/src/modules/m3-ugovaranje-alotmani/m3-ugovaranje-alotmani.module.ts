import { Module } from '@nestjs/common';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ContractsModule } from './contracts/contracts.module';
import { ContractPeriodsModule } from './contract-periods/contract-periods.module';
import { PricelistImportsModule } from './pricelist-imports/pricelist-imports.module';

// docs/moduli/M03-ugovaranje-alotmani/04-SPECIFIKACIJA-M3-UGOVARANJE-ALOTMANI.md
@Module({
  imports: [SuppliersModule, ContractsModule, ContractPeriodsModule, PricelistImportsModule],
})
export class M3UgovaranjeAlotmaniModule {}
