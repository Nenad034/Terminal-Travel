import { Module } from '@nestjs/common';
import { ClientAccountsModule } from './client-accounts/client-accounts.module';
import { GuestProfilesModule } from './guest-profiles/guest-profiles.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CommunicationLogModule } from './communication-log/communication-log.module';
import { PostTripSurveysModule } from './post-trip-surveys/post-trip-surveys.module';
import { M6EventsModule } from './events/m6-events.module';

// docs/moduli/M06-crm/09-SPECIFIKACIJA-M6-CRM.md
@Module({
  imports: [
    ClientAccountsModule,
    GuestProfilesModule,
    LoyaltyModule,
    CommunicationLogModule,
    PostTripSurveysModule,
    M6EventsModule,
  ],
  exports: [ClientAccountsModule, GuestProfilesModule, LoyaltyModule],
})
export class M6CrmModule {}
