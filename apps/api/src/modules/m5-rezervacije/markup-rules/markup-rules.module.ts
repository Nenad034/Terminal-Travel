import { Module } from '@nestjs/common';
import { MarkupRulesService } from './markup-rules.service';
import { MarkupRulesController } from './markup-rules.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [MarkupRulesController],
  providers: [MarkupRulesService],
  exports: [MarkupRulesService],
})
export class MarkupRulesModule {}
