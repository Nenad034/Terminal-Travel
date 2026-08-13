import { Module } from '@nestjs/common';
import { CommissionAuthorityService } from './commission-authority.service';
import { CommissionVolumeTiersService } from './commission-volume-tiers.service';
import { SubagentVolumeStatusService } from './subagent-volume-status.service';
import { CommissionRebatesService } from './commission-rebates.service';
import { FiscalDocumentStubService } from './fiscal-document-stub.service';
import { CommissionController } from './commission.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { FiscalDocumentsModule } from '../../m10-finansije/fiscal-documents/fiscal-documents.module';
import { ClientAccountsModule } from '../../m6-crm/client-accounts/client-accounts.module';

// M7 spec §3.1/§3.2 — namerno bez zavisnosti od SubagentsModule (vidi napomenu u
// CommissionAuthorityService) da SubagentsModule može da uvozi ovaj modul bez kružne zavisnosti.
// FiscalDocumentsModule (M10) i ClientAccountsModule (M6) su uvezeni radi FiscalDocumentStubService
// (M10 spec §5.1a) — smer M7→M10/M6, nikad obrnuto (vidi napomenu u fiscal-document-stub.service.ts).
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, FiscalDocumentsModule, ClientAccountsModule],
  controllers: [CommissionController],
  providers: [
    CommissionAuthorityService,
    CommissionVolumeTiersService,
    SubagentVolumeStatusService,
    CommissionRebatesService,
    FiscalDocumentStubService,
  ],
  exports: [CommissionVolumeTiersService, SubagentVolumeStatusService, CommissionRebatesService],
})
export class CommissionModule {}
