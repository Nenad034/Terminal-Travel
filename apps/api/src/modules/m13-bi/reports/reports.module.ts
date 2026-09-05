import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { M19KomunikacionaPlatformaModule } from '../../m19-komunikaciona-platforma/m19-komunikaciona-platforma.module';

// M19KomunikacionaPlatformaModule dodat v1.5 (deljenje izveštaja u chat, spec §7) — isti obrazac
// kao M15 (`m15-ai-orkestracija.module.ts`) koji već uvozi i ovaj modul i ovaj (ReportsModule)
// istovremeno. M19 modul ne uvozi ni M13 ni M15 nazad (`m19-komunikaciona-platforma.module.ts`
// uvozi samo Auth/Permissions/AuditLog/EventBus/M18) — nema kružne zavisnosti.
@Module({
  imports: [AuthModule, PermissionsModule, M19KomunikacionaPlatformaModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
