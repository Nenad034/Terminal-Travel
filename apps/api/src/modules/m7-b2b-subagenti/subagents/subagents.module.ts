import { Module } from '@nestjs/common';
import { SubagentsService } from './subagents.service';
import { SubagentsController } from './subagents.controller';
import { SubagentNoticesService } from './subagent-notices.service';
import { SubagentNoticesController } from './subagent-notices.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, CommissionModule],
  // §5b (17.9.2026) — obaveštenja subagentima o akciji pred istek.
  controllers: [SubagentsController, SubagentNoticesController],
  providers: [SubagentsService, SubagentNoticesService],
  exports: [SubagentsService, SubagentNoticesService],
})
export class SubagentsModule {}
