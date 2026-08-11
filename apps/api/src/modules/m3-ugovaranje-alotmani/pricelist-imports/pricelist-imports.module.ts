import { Module } from '@nestjs/common';
import { PricelistImportsService } from './pricelist-imports.service';
import { PricelistImportsController } from './pricelist-imports.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [PricelistImportsController],
  providers: [PricelistImportsService],
  exports: [PricelistImportsService],
})
export class PricelistImportsModule {}
