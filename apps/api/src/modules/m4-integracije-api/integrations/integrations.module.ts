import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from '../integrations.service';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { ProviderRegistryService } from '../provider-registry.service';
import { DictionaryCacheService } from '../dictionary-cache.service';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuthModule, AuditLogModule, EventBusModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, CircuitBreakerService, ProviderRegistryService, DictionaryCacheService],
  exports: [IntegrationsService, ProviderRegistryService],
})
export class IntegrationsModule {}
