import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { QuoteItemBuilderService } from './quote-item-builder.service';
import { MarkupRulesModule } from '../markup-rules/markup-rules.module';
import { IntegrationsModule } from '../../m4-integracije-api/integrations/integrations.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { BookingsModule } from '../bookings/bookings.module';
import { LoyaltyBridgeService } from '../common/loyalty-bridge.service';
import { LoyaltyModule } from '../../m6-crm/loyalty/loyalty.module';
import { SubagentBridgeService } from '../common/subagent-bridge.service';
import { SubagentsModule } from '../../m7-b2b-subagenti/subagents/subagents.module';
import { CommissionModule } from '../../m7-b2b-subagenti/commission/commission.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';

@Module({
  imports: [
    MarkupRulesModule,
    IntegrationsModule,
    AuthModule,
    PermissionsModule,
    BookingsModule,
    LoyaltyModule,
    SubagentsModule,
    CommissionModule,
    AuditLogModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteItemBuilderService, LoyaltyBridgeService, SubagentBridgeService],
  exports: [QuoteItemBuilderService, QuotesService],
})
export class QuotesModule {}
