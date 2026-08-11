import { Module } from '@nestjs/common';
import { SupplierAnnouncementRulesService } from './supplier-announcement-rules.service';
import { SupplierAnnouncementRulesController } from './supplier-announcement-rules.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [SupplierAnnouncementRulesController],
  providers: [SupplierAnnouncementRulesService],
  exports: [SupplierAnnouncementRulesService],
})
export class SupplierAnnouncementRulesModule {}
