import { Module } from '@nestjs/common';
import { SupplierPaymentInstructionsService } from './supplier-payment-instructions.service';
import { RefundInstructionsService } from './refund-instructions.service';
import { SupplierPaymentsController } from './supplier-payments.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [SupplierPaymentsController],
  providers: [SupplierPaymentInstructionsService, RefundInstructionsService],
  exports: [SupplierPaymentInstructionsService, RefundInstructionsService],
})
export class SupplierPaymentsModule {}
