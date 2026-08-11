import { Module } from '@nestjs/common';
import { ProviderConfigsModule } from './provider-configs/provider-configs.module';
import { ProviderCallLogsModule } from './provider-call-logs/provider-call-logs.module';
import { IntegrationsModule } from './integrations/integrations.module';

// docs/moduli/M04-integracije-api/05-SPECIFIKACIJA-M4-INTEGRACIJE-API.md
@Module({
  imports: [ProviderConfigsModule, ProviderCallLogsModule, IntegrationsModule],
})
export class M4IntegracijeApiModule {}
