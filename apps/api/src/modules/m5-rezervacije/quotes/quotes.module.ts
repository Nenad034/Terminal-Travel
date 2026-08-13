import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { QuoteItemBuilderService } from './quote-item-builder.service';
import { MarkupRulesModule } from '../markup-rules/markup-rules.module';
import { IntegrationsModule } from '../../m4-integracije-api/integrations/integrations.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { BookingsModule } from '../bookings/bookings.module';
import { LoyaltyStubService } from '../common/loyalty-stub.service';
import { LoyaltyModule } from '../../m6-crm/loyalty/loyalty.module';
import { SubagentStubService } from '../common/subagent-stub.service';
import { SubagentsModule } from '../../m7-b2b-subagenti/subagents/subagents.module';
import { CommissionModule } from '../../m7-b2b-subagenti/commission/commission.module';

@Module({
  imports: [MarkupRulesModule, IntegrationsModule, AuthModule, PermissionsModule, BookingsModule, LoyaltyModule, SubagentsModule, CommissionModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteItemBuilderService, LoyaltyStubService, SubagentStubService],
  exports: [QuoteItemBuilderService, QuotesService],
})
export class QuotesModule {}
