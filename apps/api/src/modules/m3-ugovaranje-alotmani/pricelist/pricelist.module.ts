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

// M3 spec §2.11 (v1.27) — cenovnik kao mreža; §2.11l (v1.33) — verzije cenovnika;
// §2.11o (v1.34) — kalendar; §4.8 (v1.35) — izmena rečima.
@Module({
  imports: [
    AuditLogModule,
    AuthModule,
    PermissionsModule,
    CapacityModule,
    // §4.8 — zbog `AgentInvocationLogService`: svaki poziv jezičkom modelu se beleži.
    M18OperativniNadzorModule,
  ],
  controllers: [PricelistController, PricelistVersionsController],
  providers: [
    PricelistService,
    PricelistVersionsService,
    PricelistCalendarService,
    PricelistInstructionService,
    // Nije izvezen iz M15 modula (samo registrovan lokalno tamo) i zavisi isključivo od globalnog
    // `ConfigService`, pa se registruje kao sopstven provider — isto kao u `PricelistImportsModule`.
    AnthropicClientService,
  ],
  exports: [PricelistService, PricelistVersionsService, PricelistCalendarService],
})
export class PricelistModule {}
