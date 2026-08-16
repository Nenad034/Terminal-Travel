import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { M1CoreIdentitetModule } from './modules/m1-core-identitet/m1-core-identitet.module';
import { M2KatalogProizvodaModule } from './modules/m2-katalog-proizvoda/m2-katalog-proizvoda.module';
import { M3UgovaranjeAlotmaniModule } from './modules/m3-ugovaranje-alotmani/m3-ugovaranje-alotmani.module';
import { M4IntegracijeApiModule } from './modules/m4-integracije-api/m4-integracije-api.module';
import { M5RezervacijeModule } from './modules/m5-rezervacije/m5-rezervacije.module';
import { M6CrmModule } from './modules/m6-crm/m6-crm.module';
import { M10FinansijeModule } from './modules/m10-finansije/m10-finansije.module';
import { M11ComplianceModule } from './modules/m11-compliance/m11-compliance.module';
import { M7B2bSubagentiModule } from './modules/m7-b2b-subagenti/m7-b2b-subagenti.module';
import { M20UgovoriKlijentiModule } from './modules/m20-ugovori-klijenti/m20-ugovori-klijenti.module';
import { M14HelpdeskModule } from './modules/m14-helpdesk/m14-helpdesk.module';
import { M13BiModule } from './modules/m13-bi/m13-bi.module';
import { M12MarketingModule } from './modules/m12-marketing/m12-marketing.module';
import { M16McpDistribucijaModule } from './modules/m16-mcp-distribucija/m16-mcp-distribucija.module';
import { M9MobilnaAplikacijaModule } from './modules/m9-mobilna-aplikacija/m9-mobilna-aplikacija.module';
import { M15AiOrkestracijaModule } from './modules/m15-ai-orkestracija/m15-ai-orkestracija.module';
import { M18OperativniNadzorModule } from './modules/m18-operativni-nadzor/m18-operativni-nadzor.module';
import { M19KomunikacionaPlatformaModule } from './modules/m19-komunikaciona-platforma/m19-komunikaciona-platforma.module';
import { M21CentarZaPomocModule } from './modules/m21-centar-za-pomoc/m21-centar-za-pomoc.module';
import { M22EmailInboxModule } from './modules/m22-email-inbox/m22-email-inbox.module';
import { M23ZnanjeModule } from './modules/m23-znanje/m23-znanje.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(), // M5 spec §6.1 — podsetnici/alarmi (RemindersService, @Cron)
    PrismaModule,
    M1CoreIdentitetModule,
    M2KatalogProizvodaModule,
    M3UgovaranjeAlotmaniModule,
    M4IntegracijeApiModule,
    M5RezervacijeModule,
    M6CrmModule,
    M10FinansijeModule,
    M11ComplianceModule,
    M7B2bSubagentiModule,
    M20UgovoriKlijentiModule,
    M14HelpdeskModule,
    M13BiModule,
    M12MarketingModule,
    M16McpDistribucijaModule,
    M9MobilnaAplikacijaModule,
    M15AiOrkestracijaModule,
    M18OperativniNadzorModule,
    M19KomunikacionaPlatformaModule,
    M21CentarZaPomocModule,
    M22EmailInboxModule,
    M23ZnanjeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
