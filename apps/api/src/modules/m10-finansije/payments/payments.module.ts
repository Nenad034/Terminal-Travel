import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { BookingsModule } from '../../m5-rezervacije/bookings/bookings.module';
import { PaymentTermsModule } from '../payment-terms/payment-terms.module';
import { MockPaymentGatewayAdapter } from '../adapters/mock-payment-gateway.adapter';
import { PAYMENT_GATEWAY_ADAPTER } from '../adapters/payment-gateway.token';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, BookingsModule, PaymentTermsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentGatewayAdapter,
    { provide: PAYMENT_GATEWAY_ADAPTER, useExisting: MockPaymentGatewayAdapter },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
