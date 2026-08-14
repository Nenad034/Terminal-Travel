import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { MarkupRulesModule } from '../markup-rules/markup-rules.module';
import { IntegrationsModule } from '../../m4-integracije-api/integrations/integrations.module';

@Module({
  // PermissionsModule — SearchController ručno proverava M5/booking/VIEW za
  // channel=INTERNAL_PANEL (avgust 2026, otkriveno pri implementaciji M17).
  imports: [AuthModule, PermissionsModule, MarkupRulesModule, IntegrationsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
