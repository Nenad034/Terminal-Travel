import { Module } from '@nestjs/common';
import { FiscalDocumentsService } from './fiscal-documents.service';
import { FiscalDocumentsController } from './fiscal-documents.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { MockFiscalizationGatewayAdapter } from '../adapters/mock-fiscalization-gateway.adapter';
import { FISCALIZATION_GATEWAY_ADAPTER } from '../adapters/fiscalization-gateway.token';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, ExchangeRatesModule, EventBusModule],
  controllers: [FiscalDocumentsController],
  providers: [
    FiscalDocumentsService,
    MockFiscalizationGatewayAdapter,
    { provide: FISCALIZATION_GATEWAY_ADAPTER, useExisting: MockFiscalizationGatewayAdapter },
  ],
  exports: [FiscalDocumentsService],
})
export class FiscalDocumentsModule {}
