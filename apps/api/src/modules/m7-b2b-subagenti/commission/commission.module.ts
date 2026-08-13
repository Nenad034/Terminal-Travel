import { Module } from '@nestjs/common';
import { CommissionAuthorityService } from './commission-authority.service';
import { CommissionVolumeTiersService } from './commission-volume-tiers.service';
import { SubagentVolumeStatusService } from './subagent-volume-status.service';
import { CommissionRebatesService } from './commission-rebates.service';
import { CommissionController } from './commission.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

// M7 spec §3.1/§3.2 — namerno bez zavisnosti od SubagentsModule (vidi napomenu u
// CommissionAuthorityService) da SubagentsModule može da uvozi ovaj modul bez kružne zavisnosti.
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [CommissionController],
  providers: [CommissionAuthorityService, CommissionVolumeTiersService, SubagentVolumeStatusService, CommissionRebatesService],
  exports: [CommissionVolumeTiersService, SubagentVolumeStatusService, CommissionRebatesService],
})
export class CommissionModule {}
