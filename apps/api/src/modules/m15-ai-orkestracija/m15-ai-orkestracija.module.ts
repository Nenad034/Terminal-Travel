import { Module } from '@nestjs/common';
import { ModuleActivationController } from './module-activation/module-activation.controller';
import { ModuleActivationService } from './module-activation/module-activation.service';
import { OmnisearchController } from './omnisearch/omnisearch.controller';
import { OmnisearchService } from './omnisearch/omnisearch.service';
import { AnthropicClientService } from './anthropic/anthropic-client.service';
import { AuthModule } from '../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../m1-core-identitet/permissions/permissions.module';
import { AuditLogModule } from '../m1-core-identitet/audit-log/audit-log.module';
import { BookingsModule } from '../m5-rezervacije/bookings/bookings.module';
import { ProductsModule } from '../m2-katalog-proizvoda/products/products.module';

// docs/moduli/M15-ai-orkestracija/18-SPECIFIKACIJA-M15-AI-ORKESTRACIJA.md — prvi prolaz
// (avgust 2026): samo omnisearch (§6.5) za M17 kanal. Uvozi BookingsModule/ProductsModule da
// pozove njihove servise IN-PROCESS sa identitetom korisnika koji pretražuje (§6.5.2) — ne
// preko HTTP-a, isti obrazac kao SearchModule (M5) koji uvozi MarkupRulesModule/IntegrationsModule.
@Module({
  imports: [AuthModule, PermissionsModule, AuditLogModule, BookingsModule, ProductsModule],
  controllers: [ModuleActivationController, OmnisearchController],
  providers: [ModuleActivationService, OmnisearchService, AnthropicClientService],
  exports: [OmnisearchService],
})
export class M15AiOrkestracijaModule {}
