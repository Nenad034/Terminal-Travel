import { Module } from '@nestjs/common';
import { MarkupRulesModule } from './markup-rules/markup-rules.module';
import { SearchModule } from './search/search.module';
import { QuotesModule } from './quotes/quotes.module';
import { ItinerariesModule } from './itineraries/itineraries.module';
import { BookingsModule } from './bookings/bookings.module';
import { SupplierManifestsModule } from './supplier-manifests/supplier-manifests.module';
import { SupplierAnnouncementRulesModule } from './supplier-announcement-rules/supplier-announcement-rules.module';
import { RemindersModule } from './reminders/reminders.module';

// docs/moduli/M05-rezervacije/06-SPECIFIKACIJA-M5-REZERVACIJE.md
@Module({
  imports: [
    MarkupRulesModule,
    SearchModule,
    BookingsModule,
    QuotesModule,
    ItinerariesModule,
    SupplierManifestsModule,
    SupplierAnnouncementRulesModule,
    RemindersModule,
  ],
})
export class M5RezervacijeModule {}
