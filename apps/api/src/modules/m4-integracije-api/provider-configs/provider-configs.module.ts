import { Module } from '@nestjs/common';
import { ProviderConfigsService } from './provider-configs.service';
import { ProviderConfigsController } from './provider-configs.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, IntegrationsModule],
  controllers: [ProviderConfigsController],
  providers: [ProviderConfigsService],
  exports: [ProviderConfigsService],
})
export class ProviderConfigsModule {}
