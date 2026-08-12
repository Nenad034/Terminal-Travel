import { Module } from '@nestjs/common';
import { SupplierInvoiceImportsService } from './supplier-invoice-imports.service';
import { SupplierInvoiceImportsController } from './supplier-invoice-imports.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, ExchangeRatesModule],
  controllers: [SupplierInvoiceImportsController],
  providers: [SupplierInvoiceImportsService],
  exports: [SupplierInvoiceImportsService],
})
export class SupplierInvoiceImportsModule {}
