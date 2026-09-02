import { Module } from '@nestjs/common';
import { GuestDocumentScanController } from './guest-document-scan.controller';
import { GuestDocumentScanService } from './guest-document-scan.service';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
// AnthropicClientService (M15) registrovan lokalno kao provider, isti obrazac kao M21
// (m21-centar-za-pomoc.module.ts) — zavisi samo od ConfigService/PrismaService, nema potrebe
// da se uveze ceo M15AiOrkestracijaModule.
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [GuestDocumentScanController],
  providers: [GuestDocumentScanService, AnthropicClientService],
})
export class GuestDocumentScanModule {}
