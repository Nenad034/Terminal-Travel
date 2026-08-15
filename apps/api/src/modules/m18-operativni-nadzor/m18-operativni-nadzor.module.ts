import { Module } from '@nestjs/common';
import { HealthSignalsController } from './health-signals/health-signals.controller';
import { HealthSignalsService } from './health-signals/health-signals.service';
import { HealthDetectorsService } from './detectors/health-detectors.service';
import { M18EventSubscribersService } from './event-subscribers/m18-event-subscribers.service';
import { ProviderHealthController } from './provider-health/provider-health.controller';
import { ProviderHealthService } from './provider-health/provider-health.service';
import { NotificationChannelsController } from './notification-channels/notification-channels.controller';
import { NotificationChannelsService } from './notification-channels/notification-channels.service';
import { NotificationDispatchService } from './notification-channels/notification-dispatch.service';
import { TelegramClientService } from './notification-channels/telegram-client.service';
import { EmailClientService } from './notification-channels/email-client.service';
import { WeeklyReviewsController } from './weekly-reviews/weekly-reviews.controller';
import { WeeklyReviewsService } from './weekly-reviews/weekly-reviews.service';
import { TrendSuggestionsController } from './trend-suggestions/trend-suggestions.controller';
import { TrendSuggestionsService } from './trend-suggestions/trend-suggestions.service';
import { AgentInvocationsController } from './agent-invocations/agent-invocations.controller';
import { AgentInvocationLogService } from './agent-invocations/agent-invocation-log.service';
import { ModelTierResolverService } from './agent-invocations/model-tier-resolver.service';
import { AiProviderQuotaController } from './ai-provider-quota/ai-provider-quota.controller';
import { AiProviderQuotaService } from './ai-provider-quota/ai-provider-quota.service';
import { AiAgentBudgetsController } from './ai-agent-budgets/ai-agent-budgets.controller';
import { AiAgentBudgetsService } from './ai-agent-budgets/ai-agent-budgets.service';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { EventBusModule } from '../../common/events/event-bus.module';

// docs/moduli/M18-operativni-nadzor/19-SPECIFIKACIJA-M18-OPERATIVNI-NADZOR.md — prvi prolaz
// implementacije (avgust 2026). Flat modul (isti stil kao M15), read-only nad ostalim
// modulima (§1, direktan Prisma read + pretplata na postojeće Event Bus signale) — zato ne
// zahteva uvoz M3/M4/M9/M10/M11 modula, samo AuthModule/PermissionsModule/AuditLogModule
// (guard-ovi + ručni override trag) i EventBusModule (pretplata, poglavlje "Nalazi istraživanja").
@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, EventBusModule],
  controllers: [
    HealthSignalsController,
    ProviderHealthController,
    NotificationChannelsController,
    WeeklyReviewsController,
    TrendSuggestionsController,
    AgentInvocationsController,
    AiProviderQuotaController,
    AiAgentBudgetsController,
  ],
  providers: [
    HealthSignalsService,
    HealthDetectorsService,
    M18EventSubscribersService,
    ProviderHealthService,
    NotificationChannelsService,
    NotificationDispatchService,
    TelegramClientService,
    EmailClientService,
    WeeklyReviewsService,
    TrendSuggestionsService,
    AgentInvocationLogService,
    ModelTierResolverService,
    AiProviderQuotaService,
    AiAgentBudgetsService,
  ],
  exports: [AgentInvocationLogService],
})
export class M18OperativniNadzorModule {}
