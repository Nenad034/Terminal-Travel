import { Module } from '@nestjs/common';
import { ProductContentImportsService } from './product-content-imports.service';
import { ProductContentImportsController } from './product-content-imports.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [ProductContentImportsController],
  providers: [ProductContentImportsService],
  exports: [ProductContentImportsService],
})
export class ProductContentImportsModule {}
