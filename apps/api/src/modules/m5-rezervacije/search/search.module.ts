import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchLogService } from './search-log.service';
import { SearchController } from './search.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { MarkupRulesModule } from '../markup-rules/markup-rules.module';
import { IntegrationsModule } from '../../m4-integracije-api/integrations/integrations.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  // PermissionsModule — SearchController ručno proverava M5/booking/VIEW za
  // channel=INTERNAL_PANEL (avgust 2026, otkriveno pri implementaciji M17).
  // EventBusModule — M5 §3.0b.3 (9.9.2026): pretraga javlja proizvod bez marže umesto da
  // obori ceo upit; M18 se na to pretplaćuje i pravi HealthSignal.
  imports: [AuthModule, PermissionsModule, MarkupRulesModule, IntegrationsModule, EventBusModule],
  controllers: [SearchController],
  providers: [SearchService, SearchLogService],
  exports: [SearchService],
})
export class SearchModule {}
