import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { QuoteItemBuilderService } from '../quotes/quote-item-builder.service';
import { ComplianceStubsService } from '../common/compliance-stubs.service';
import { ClientContractStubService } from '../common/client-contract-stub.service';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { ContractPeriodsModule } from '../../m3-ugovaranje-alotmani/contract-periods/contract-periods.module';
import { IntegrationsModule } from '../../m4-integracije-api/integrations/integrations.module';
import { MarkupRulesModule } from '../markup-rules/markup-rules.module';
import { SupplierManifestsModule } from '../supplier-manifests/supplier-manifests.module';
import { TravelGuaranteeModule } from '../../m11-compliance/travel-guarantee/travel-guarantee.module';
import { ClientContractsModule } from '../../m20-ugovori-klijenti/client-contracts/client-contracts.module';

// M5 spec §4-§8 (jezgro tok potvrde/upravljanja rezervacijom). QuoteItemBuilderService se
// namerno instancira i ovde (ne uvozi se iz QuotesModule) da bi se izbegla kružna zavisnost
// QuotesModule ↔ BookingsModule (QuotesModule uvozi BookingsModule za /quotes/:id/confirm).
@Module({
  imports: [
    AuditLogModule,
    AuthModule,
    PermissionsModule,
    EventBusModule,
    ContractPeriodsModule,
    IntegrationsModule,
    MarkupRulesModule,
    SupplierManifestsModule,
    TravelGuaranteeModule,
    ClientContractsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, QuoteItemBuilderService, ComplianceStubsService, ClientContractStubService],
  exports: [BookingsService],
})
export class BookingsModule {}
