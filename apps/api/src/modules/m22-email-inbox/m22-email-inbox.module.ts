import { Module } from '@nestjs/common';
import { MailboxesController } from './mailboxes/mailboxes.controller';
import { MailboxesService } from './mailboxes/mailboxes.service';
import { EmailThreadsController } from './email-threads/email-threads.controller';
import { EmailThreadsService } from './email-threads/email-threads.service';
import { TicketConversionController } from './ticket-conversion/ticket-conversion.controller';
import { TicketConversionService } from './ticket-conversion/ticket-conversion.service';
import { CorrespondentMatcherService } from './correspondent-matching/correspondent-matcher.service';
import { ReferenceMatcherService } from './reference-matching/reference-matcher.service';
import { EmailAiAssistantService } from './ai-assistant/email-ai-assistant.service';
import { EmailProviderFactory } from './email-provider/email-provider.factory';
import { MockEmailProviderAdapter } from './email-provider/mock-email-provider-adapter.service';
import { SmtpEmailProviderAdapter } from './email-provider/smtp-email-provider-adapter.service';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { AnthropicClientService } from '../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { M18OperativniNadzorModule } from '../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { M14HelpdeskModule } from '../m14-helpdesk/m14-helpdesk.module';

// docs/moduli/M22-email-inbox/25-SPECIFIKACIJA-M22-EMAIL-INBOX.md — prvi prolaz implementacije
// (avgust 2026, backend, isti flat-modul obrazac kao M18/M19/M21). AuthModule (JwtAuthGuard)/
// PermissionsModule (RBAC gruba kapija)/AuditLogModule su standardni. M18OperativniNadzorModule
// daje AgentInvocationLogService (§4 logovanje AI poziva). M14HelpdeskModule daje TicketsService
// (§8 convert-to-ticket — in-process DI poziv, isti hibridni obrazac kao M21→M14 eskalacija).
// AnthropicClientService (M15) registrovan lokalno kao sopstveni provider (isti princip kao
// M19/M21 — zavisi samo od globalnog ConfigService, ne od ostatka M15 modula).
@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, M18OperativniNadzorModule, M14HelpdeskModule],
  controllers: [MailboxesController, EmailThreadsController, TicketConversionController],
  providers: [
    MailboxesService,
    EmailThreadsService,
    TicketConversionService,
    CorrespondentMatcherService,
    ReferenceMatcherService,
    EmailAiAssistantService,
    EmailProviderFactory,
    MockEmailProviderAdapter,
    SmtpEmailProviderAdapter,
    AnthropicClientService,
  ],
  // M5 §8.8 (5.9.2026) — najava dobavljaču ide kroz jedinstveno M22 sanduče, pa M5
  // `SupplierMailboxService` treba ove tri stvari (in-process DI, isti hibridni obrazac kao
  // M22→M14 konverzija u tiket iznad).
  exports: [MailboxesService, EmailProviderFactory],
})
export class M22EmailInboxModule {}
