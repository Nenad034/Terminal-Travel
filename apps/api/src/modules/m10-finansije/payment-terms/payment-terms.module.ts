import { Module } from '@nestjs/common';
import { PaymentTermsConfigService } from './payment-terms-config.service';
import { ClientPaymentSchedulesService } from './client-payment-schedules.service';
import { PaymentTermsController } from './payment-terms.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, EventBusModule],
  controllers: [PaymentTermsController],
  providers: [PaymentTermsConfigService, ClientPaymentSchedulesService],
  exports: [PaymentTermsConfigService, ClientPaymentSchedulesService],
})
export class PaymentTermsModule {}
