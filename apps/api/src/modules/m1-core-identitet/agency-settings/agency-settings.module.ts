import { Module } from '@nestjs/common';
import { AgencySettingsController } from './agency-settings.controller';
import { PublicAgencyController } from './public-agency.controller';
import { AgencySettingsService } from './agency-settings.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

// Isti obrazac kao `BranchesModule`: guard-ovi na kontroleru traže `JwtService`/`PermissionsService`.
// `exports` — M20 (ugovori sa gostom) čita naziv/adresu/licencu odavde, umesto iz sopstvenih
// env promenljivih (M1 spec §3.9c, M20 §2.3).
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [AgencySettingsController, PublicAgencyController],
  providers: [AgencySettingsService],
  exports: [AgencySettingsService],
})
export class AgencySettingsModule {}
