import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { M1CoreIdentitetModule } from './modules/m1-core-identitet/m1-core-identitet.module';
import { M2KatalogProizvodaModule } from './modules/m2-katalog-proizvoda/m2-katalog-proizvoda.module';
import { M3UgovaranjeAlotmaniModule } from './modules/m3-ugovaranje-alotmani/m3-ugovaranje-alotmani.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    M1CoreIdentitetModule,
    M2KatalogProizvodaModule,
    M3UgovaranjeAlotmaniModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
