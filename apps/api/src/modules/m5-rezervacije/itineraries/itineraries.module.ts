import { Module } from '@nestjs/common';
import { ItinerariesService } from './itineraries.service';
import { ItinerariesController } from './itineraries.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { QuotesModule } from '../quotes/quotes.module';
import { SubagentBridgeService } from '../common/subagent-bridge.service';
import { SubagentsModule } from '../../m7-b2b-subagenti/subagents/subagents.module';
import { CommissionModule } from '../../m7-b2b-subagenti/commission/commission.module';

// IDOR pregled (31.8.2026) — SubagentsModule/CommissionModule dodati da ItinerariesService
// može da koristi resolveApiContext/SubagentBridgeService (isti obrazac kao QuotesModule).
@Module({
  imports: [AuthModule, PermissionsModule, QuotesModule, SubagentsModule, CommissionModule],
  controllers: [ItinerariesController],
  providers: [ItinerariesService, SubagentBridgeService],
  exports: [ItinerariesService],
})
export class ItinerariesModule {}
