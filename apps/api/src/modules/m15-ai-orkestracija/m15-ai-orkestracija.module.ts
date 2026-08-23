import { Module } from '@nestjs/common';
import { ModuleActivationController } from './module-activation/module-activation.controller';
import { ModuleActivationService } from './module-activation/module-activation.service';
import { OmnisearchController } from './omnisearch/omnisearch.controller';
import { OmnisearchService } from './omnisearch/omnisearch.service';
import { AnthropicClientService } from './anthropic/anthropic-client.service';
import { ActionTypesController } from './action-types/action-types.controller';
import { ActionTypesService } from './action-types/action-types.service';
import { AgentInboxController } from './agent-inbox/agent-inbox.controller';
import { AgentInboxService } from './agent-inbox/agent-inbox.service';
import { BiTerminalController } from './bi-terminal/bi-terminal.controller';
import { BiTerminalService } from './bi-terminal/bi-terminal.service';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { BookingsModule } from '../m5-rezervacije/bookings/bookings.module';
import { ProductsModule } from '../m2-katalog-proizvoda/products/products.module';
import { M18OperativniNadzorModule } from '../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { M21CentarZaPomocModule } from '../m21-centar-za-pomoc/m21-centar-za-pomoc.module';
import { ReportsModule } from '../m13-bi/reports/reports.module';
import { SupplierObligationsModule } from '../m10-finansije/supplier-obligations/supplier-obligations.module';
import { SubagentsModule } from '../m7-b2b-subagenti/subagents/subagents.module';

// docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md
// v1.10 (Faza 7 prvi prolaz) dodaje pun AgentActionType registar (seed), sprovedbu na nivou
// koda (AgentActionGuard, apps/api/src/common/) i Agent Inbox — poglavlje 6/9. Agent Inbox čita
// direktno iz Prisma (isti "čitanje iz postojećih tabela više modula" princip kao M17 dashboard),
// zato ne zahteva uvoz M3/M7/M12/M14 modula ovde.
// Dopuna avgust 2026 (M8 §3a, B2C_SITE kanal) — M21CentarZaPomocModule daje HelpAssistantService
// (in-process poziv za "pitanje o platformi" tok, M15 spec §6.5.5); M21 modul ne uvozi M15 modul
// nazad (samo AnthropicClientService klasu direktno), pa nema kružne zavisnosti.
@Module({
  imports: [
    AuthModule,
    PermissionsModule,
    AuditLogModule,
    BookingsModule,
    ProductsModule,
    M18OperativniNadzorModule,
    M21CentarZaPomocModule,
    ReportsModule,
    SupplierObligationsModule,
    SubagentsModule,
  ],
  controllers: [ModuleActivationController, OmnisearchController, ActionTypesController, AgentInboxController, BiTerminalController],
  providers: [ModuleActivationService, OmnisearchService, AnthropicClientService, ActionTypesService, AgentInboxService, BiTerminalService],
  exports: [OmnisearchService],
})
export class M15AiOrkestracijaModule {}
