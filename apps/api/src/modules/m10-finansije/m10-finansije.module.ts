import { Module } from '@nestjs/common';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { FiscalDocumentsModule } from './fiscal-documents/fiscal-documents.module';
import { PaymentsModule } from './payments/payments.module';
import { BanksModule } from './banks/banks.module';
import { PaymentTermsModule } from './payment-terms/payment-terms.module';
import { SupplierObligationsModule } from './supplier-obligations/supplier-obligations.module';
import { SupplierPaymentsModule } from './supplier-payments/supplier-payments.module';
import { SupplierInvoiceImportsModule } from './supplier-invoice-imports/supplier-invoice-imports.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { M10EventsModule } from './events/m10-events.module';

// docs/moduli/M10-finansije/07-SPECIFIKACIJA-M10-FINANSIJE.md
@Module({
  imports: [
    ExchangeRatesModule,
    FiscalDocumentsModule,
    PaymentsModule,
    BanksModule,
    PaymentTermsModule,
    SupplierObligationsModule,
    SupplierPaymentsModule,
    SupplierInvoiceImportsModule,
    ReconciliationModule,
    M10EventsModule,
  ],
})
export class M10FinansijeModule {}
