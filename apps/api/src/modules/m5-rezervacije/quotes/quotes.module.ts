import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { QuoteItemBuilderService } from './quote-item-builder.service';
import { MarkupRulesModule } from '../markup-rules/markup-rules.module';
import { IntegrationsModule } from '../../m4-integracije-api/integrations/integrations.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { BookingsModule } from '../bookings/bookings.module';

@Module({
  imports: [MarkupRulesModule, IntegrationsModule, AuthModule, PermissionsModule, BookingsModule],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteItemBuilderService],
  exports: [QuoteItemBuilderService, QuotesService],
})
export class QuotesModule {}
