import { Module } from '@nestjs/common';
import { M10EventSubscribersService } from './m10-event-subscribers.service';
import { M10AlarmsService } from './m10-alarms.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { FiscalDocumentsModule } from '../fiscal-documents/fiscal-documents.module';
import { PaymentTermsModule } from '../payment-terms/payment-terms.module';
import { SupplierObligationsModule } from '../supplier-obligations/supplier-obligations.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

@Module({
  imports: [EventBusModule, FiscalDocumentsModule, PaymentTermsModule, SupplierObligationsModule, ReconciliationModule],
  providers: [M10EventSubscribersService, M10AlarmsService],
})
export class M10EventsModule {}
