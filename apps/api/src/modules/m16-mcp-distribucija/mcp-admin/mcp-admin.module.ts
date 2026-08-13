import { Module } from '@nestjs/common';
import { McpAdminService } from './mcp-admin.service';
import { McpAdminController } from './mcp-admin.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';

@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule],
  controllers: [McpAdminController],
  providers: [McpAdminService],
  exports: [McpAdminService],
})
export class McpAdminModule {}
