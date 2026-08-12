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
import { M10FinansijeModule } from './modules/m10-finansije/m10-finansije.module';
import { M11ComplianceModule } from './modules/m11-compliance/m11-compliance.module';

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
    M10FinansijeModule,
    M11ComplianceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
