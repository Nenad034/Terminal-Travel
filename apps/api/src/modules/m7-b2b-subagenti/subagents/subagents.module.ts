import { Module } from '@nestjs/common';
import { SubagentsService } from './subagents.service';
import { SubagentsController } from './subagents.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, CommissionModule],
  controllers: [SubagentsController],
  providers: [SubagentsService],
  exports: [SubagentsService],
})
export class SubagentsModule {}
