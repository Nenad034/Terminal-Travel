import { Module } from '@nestjs/common';
import { DistributionService } from './distribution.service';
import { ClientAccountsModule } from '../../m6-crm/client-accounts/client-accounts.module';
import { SubagentsModule } from '../../m7-b2b-subagenti/subagents/subagents.module';
import { SuppliersModule } from '../../m3-ugovaranje-alotmani/suppliers/suppliers.module';

// M12 spec §4 — distribucioni sloj uvozi M6 ClientAccountsModule (in-process DI) za EMAIL
// primaoce (findMarketingRecipients); FACEBOOK/INSTAGRAM/MOBILE_PUSH ne zavise ni od jednog
// drugog modula (mock/stub adapteri, poglavlje 4). B2B_SUBAGENTS (§3d/§4, 17.9.2026) uvozi M7
// (primaoci + obaveštenje na portalu) i M3 dobavljače (ograda: ime dobavljača ne sme u tekst).
@Module({
  imports: [ClientAccountsModule, SubagentsModule, SuppliersModule],
  providers: [DistributionService],
  exports: [DistributionService],
})
export class DistributionModule {}
