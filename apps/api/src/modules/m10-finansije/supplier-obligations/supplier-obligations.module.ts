import { Module } from '@nestjs/common';
import { SupplierObligationsService } from './supplier-obligations.service';
import { SupplierObligationsController } from './supplier-obligations.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, ExchangeRatesModule],
  controllers: [SupplierObligationsController],
  providers: [SupplierObligationsService],
  exports: [SupplierObligationsService],
})
export class SupplierObligationsModule {}
