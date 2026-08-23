import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations/conversations.controller';
import { ConversationsService } from './conversations/conversations.service';
import { PresenceController } from './presence/presence.controller';
import { PresenceService } from './presence/presence.service';
import { ChatGatewayService } from './chat-gateway/chat-gateway.service';
import { SupplierConversationsController } from './supplier-conversations/supplier-conversations.controller';
import { SupplierConversationsService } from './supplier-conversations/supplier-conversations.service';
import { InAppNotificationsService } from './in-app-notifications/in-app-notifications.service';
import { SupplierDraftController } from './supplier-draft/supplier-draft.controller';
import { SupplierDraftService } from './supplier-draft/supplier-draft.service';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { EventBusModule } from '../../common/events/event-bus.module';
import { AnthropicClientService } from '../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { M18OperativniNadzorModule } from '../m18-operativni-nadzor/m18-operativni-nadzor.module';

// docs/moduli/M19-komunikaciona-platforma/20-SPECIFIKACIJA-M19-KOMUNIKACIONA-PLATFORMA.md — prvi
// prolaz implementacije (avgust 2026, backend + WS gateway, bez panel/mobilne UI — vidi §10/§11).
// Flat modul (isti stil kao M18) — AuthModule (JwtService preko AuthSharedModule + AuthService za
// invite-contact tok, §9.2), PermissionsModule (RBAC), AuditLogModule, EventBusModule (M18 CRITICAL
// pretplata §5, M9 push emisija §3), M18OperativniNadzorModule (AgentInvocationLogService, §9.5
// logovanje poziva). AnthropicClientService (M15) nije izvezen iz sopstvenog modula (samo
// registrovan lokalno tamo) — zavisi isključivo od globalnog ConfigService, pa se ovde registruje
// kao sopstveni provider umesto uvoza celog M15 modula (isti minimalan-DI princip kao ostali
// direktni provideri ovog modula).
@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, EventBusModule, M18OperativniNadzorModule],
  controllers: [ConversationsController, PresenceController, SupplierConversationsController, SupplierDraftController],
  providers: [
    ConversationsService,
    PresenceService,
    ChatGatewayService,
    SupplierConversationsService,
    InAppNotificationsService,
    SupplierDraftService,
    AnthropicClientService,
  ],
  // `ConversationsService` izvezen (23.8.2026, M15 spec §6.9.3 dopuna) — BiTerminalAgent "pošalji
  // u chat" dugme (ljudski pokrenut klik, van tool-use petlje) direktno poziva postojeći M19 tok
  // za prilog uz poruku, isti mehanizam kao ručno slanje priloga u chat-u, ne novi kanal.
  exports: [ConversationsService],
})
export class M19KomunikacionaPlatformaModule {}
