import { Module } from '@nestjs/common';
import { PricelistService } from './pricelist.service';
import { PricelistController } from './pricelist.controller';
import { PricelistVersionsService } from './pricelist-versions.service';
import { PricelistVersionsController } from './pricelist-versions.controller';
import { PricelistCalendarService } from './pricelist-calendar.service';
import { CapacityModule } from '../capacity/capacity.module';
import { PricelistInstructionService } from './pricelist-instruction.service';
import { M18OperativniNadzorModule } from '../../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { OfferExpiryService } from './offer-expiry.service';
import { OfferExpiryController } from './offer-expiry.controller';
import { M3DailyJobsService } from '../scheduler/m3-daily-jobs.service';

// M3 spec §2.11 (v1.27) — cenovnik kao mreža; §2.11l (v1.33) — verzije cenovnika;
// §2.11o (v1.34) — kalendar; §4.8 (v1.35) — izmena rečima; §4.9 (v1.44) — akcija pred istek.
@Module({
  imports: [
    AuditLogModule,
    AuthModule,
    PermissionsModule,
    CapacityModule,
    // §4.8 — zbog `AgentInvocationLogService`: svaki poziv jezičkom modelu se beleži.
    M18OperativniNadzorModule,
    // §4.9 — `pricelist.offer.expiring` na Event Bus.
    EventBusModule,
  ],
  controllers: [PricelistController, PricelistVersionsController, OfferExpiryController],
  providers: [
    PricelistService,
    PricelistVersionsService,
    PricelistCalendarService,
    PricelistInstructionService,
    OfferExpiryService,
    // Dnevni raspored za M3 (blokade §2.8b + akcije pred istek §4.9).
    M3DailyJobsService,
    // Nije izvezen iz M15 modula (samo registrovan lokalno tamo) i zavisi isključivo od globalnog
    // `ConfigService`, pa se registruje kao sopstven provider — isto kao u `PricelistImportsModule`.
    AnthropicClientService,
  ],
  exports: [
    PricelistService,
    PricelistVersionsService,
    PricelistCalendarService,
    OfferExpiryService,
  ],
})
export class PricelistModule {}
