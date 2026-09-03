import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from '../integrations.service';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { ProviderRegistryService } from '../provider-registry.service';
import { DictionaryCacheService } from '../dictionary-cache.service';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
// PermissionsModule je neophodan otkad kontroler nosi @RequirePermission (M4 spec §6, dopuna
// 3.9.2026) — PermissionsGuard zavisi od PermissionsService, isti obrazac kao ProviderConfigsModule.
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuthModule, AuditLogModule, PermissionsModule, EventBusModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CircuitBreakerService, ProviderRegistryService, DictionaryCacheService],
  exports: [IntegrationsService, ProviderRegistryService],
})
export class IntegrationsModule {}
