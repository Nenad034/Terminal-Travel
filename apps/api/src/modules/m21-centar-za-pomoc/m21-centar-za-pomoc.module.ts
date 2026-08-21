import { Module } from '@nestjs/common';
import { HelpArticlesController } from './help-articles/help-articles.controller';
import { HelpArticlesService } from './help-articles/help-articles.service';
import { HelpAssistantController } from './help-assistant/help-assistant.controller';
import { HelpAssistantService } from './help-assistant/help-assistant.service';
import { HelpSuggestionsController } from './help-suggestions/help-suggestions.controller';
import { HelpSuggestionsService } from './help-suggestions/help-suggestions.service';
import { HelpAbuseDetectorService } from './abuse-detection/help-abuse-detector.service';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { AnthropicClientService } from '../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { OpenAiEmbeddingService } from '../m15-ai-orkestracija/openai/openai-embedding.service';
import { M18OperativniNadzorModule } from '../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { M14HelpdeskModule } from '../m14-helpdesk/m14-helpdesk.module';

// docs/moduli/M21-centar-za-pomoc/23-SPECIFIKACIJA-M21-CENTAR-ZA-POMOC.md — prvi prolaz
// implementacije (avgust 2026, backend, isti flat-modul obrazac kao M18/M19). AuthModule
// (JwtService)/PermissionsModule (RBAC)/AuditLogModule (svako pitanje/odgovor upisuje trag,
// §5.5) su standardni. M18OperativniNadzorModule daje AgentInvocationLogService (§18 logovanje
// poziva) i HealthSignalsService (dodato u exports u ovom prolazu — §5.5 abuse detekcija).
// M14HelpdeskModule daje TicketsService (§5.3 eskalacija — in-process DI poziv, isti hibridni
// obrazac kao M13 FactSyncService). AnthropicClientService (M15) registrovan lokalno kao
// sopstveni provider (isti princip kao M19KomunikacionaPlatformaModule — zavisi samo od
// globalnog ConfigService, ne od ostatka M15 modula).
@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, M18OperativniNadzorModule, M14HelpdeskModule],
  controllers: [HelpArticlesController, HelpAssistantController, HelpSuggestionsController],
  providers: [HelpArticlesService, HelpAssistantService, HelpSuggestionsService, HelpAbuseDetectorService, AnthropicClientService, OpenAiEmbeddingService],
  // HelpAssistantService dopunjeno avgust 2026 (M8 §3a) — M15 OmnisearchService poziva ga
  // in-process za B2C_SITE "pitanje o platformi" tok (M15 spec §6.5.5), isti obrazac kao
  // M14HelpdeskModule.exports (TicketsService) korišćen ovde iznad.
  exports: [HelpAssistantService],
})
export class M21CentarZaPomocModule {}
