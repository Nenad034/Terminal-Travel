import { Module } from '@nestjs/common';
import { FactSyncService } from './fact-sync.service';
import { ProductsModule } from '../../m2-katalog-proizvoda/products/products.module';
import { ContractsModule } from '../../m3-ugovaranje-alotmani/contracts/contracts.module';
import { SuppliersModule } from '../../m3-ugovaranje-alotmani/suppliers/suppliers.module';
import { ClientAccountsModule } from '../../m6-crm/client-accounts/client-accounts.module';
import { SubagentsModule } from '../../m7-b2b-subagenti/subagents/subagents.module';
import { PaymentsModule } from '../../m10-finansije/payments/payments.module';
import { ExchangeRatesModule } from '../../m10-finansije/exchange-rates/exchange-rates.module';

// M13 spec §1.1/§2 — jezgro projekcije (FactBooking/FactPayment). Uvozi servise M2/M3/M6/M7/M10
// (in-process, read-only) da bi izgradio/proverio izvedenu BI projekciju, nikad obrnuto.
@Module({
  imports: [
    ProductsModule,
    ContractsModule,
    SuppliersModule,
    ClientAccountsModule,
    SubagentsModule,
    PaymentsModule,
    ExchangeRatesModule,
  ],
  providers: [FactSyncService],
  exports: [FactSyncService],
})
export class FactSyncModule {}
