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
import { TextIntakeService } from './text-intake.service';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { M18OperativniNadzorModule } from '../../m18-operativni-nadzor/m18-operativni-nadzor.module';

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
    // §3.0j — beleženje poziva modelu (M18 budžet), isti obrazac kao M3 PricelistModule.
    M18OperativniNadzorModule,
  ],
  controllers: [QuotesController],
  providers: [
    QuotesService,
    QuoteItemBuilderService,
    LoyaltyBridgeService,
    SubagentBridgeService,
    TextIntakeService,
    // Nije izvezen iz M15 modula; zavisi samo od ConfigService — isto kao u M3 PricelistModule.
    AnthropicClientService,
  ],
  exports: [QuoteItemBuilderService, QuotesService],
})
export class QuotesModule {}
