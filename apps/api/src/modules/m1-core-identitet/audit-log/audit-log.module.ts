import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuthSharedModule } from '../../../common/auth-shared.module';

@Module({
  imports: [PermissionsModule, AuthSharedModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
