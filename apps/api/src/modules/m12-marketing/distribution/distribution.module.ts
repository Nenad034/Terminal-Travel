import { Module } from '@nestjs/common';
import { DistributionService } from './distribution.service';
import { ClientAccountsModule } from '../../m6-crm/client-accounts/client-accounts.module';

// M12 spec §4 — distribucioni sloj uvozi M6 ClientAccountsModule (in-process DI) za EMAIL
// primaoce (findMarketingRecipients); FACEBOOK/INSTAGRAM/MOBILE_PUSH ne zavise ni od jednog
// drugog modula (mock/stub adapteri, poglavlje 4).
@Module({
  imports: [ClientAccountsModule],
  providers: [DistributionService],
  exports: [DistributionService],
})
export class DistributionModule {}
