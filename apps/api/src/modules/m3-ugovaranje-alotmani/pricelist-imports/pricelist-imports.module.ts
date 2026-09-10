import { Module } from '@nestjs/common';
import { PricelistImportsService } from './pricelist-imports.service';
import { PricelistExtractionService } from './pricelist-extraction.service';
import { PricelistImportsController } from './pricelist-imports.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { M18OperativniNadzorModule } from '../../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { PricelistModule } from '../pricelist/pricelist.module';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';
import { ExtractFileService } from '../../m15-ai-orkestracija/omnisearch/extract-file.service';

// M3 §4.2.6 (9.9.2026) — AI ekstrakcija cenovnika. M18OperativniNadzorModule zbog
// AgentInvocationLogService (svaki poziv jezičkom modelu se beleži). AnthropicClientService nije
// izvezen iz M15 modula (samo registrovan lokalno tamo) i zavisi isključivo od globalnog
// ConfigService, pa se ovde registruje kao sopstven provider umesto uvoza celog M15 modula —
// isti minimalan-DI princip koji M19 već koristi za SupplierDraftService.
//
// §4.2.7 (10.9.2026) — `ExtractFileService` se registruje po ISTOM obrascu, i to je namerno:
// M3 KORISTI postojeći parser iz M15 umesto da napravi svoj. Servis nema stanja ni zavisnosti
// (čiste funkcije nad baferom), pa lokalna registracija ne duplira ništa — dupliranje bi bio
// drugi parser, a to je tačno greška zbog koje ovaj repozitorijum postoji (dok. 22).
@Module({
  // §4.2.10 (10.9.2026) — `PricelistModule` zbog `PricelistVersionsService`/`PricelistService`:
  // uvoz od sada NE upisuje sam nego ide kroz isti tok verzija kao ručna izmena i izmena rečima.
  // Jedan put do cenovnika, jedno mesto na kom nastaje istorija.
  imports: [
    AuditLogModule,
    AuthModule,
    PermissionsModule,
    M18OperativniNadzorModule,
    PricelistModule,
  ],
  controllers: [PricelistImportsController],
  providers: [
    PricelistImportsService,
    PricelistExtractionService,
    AnthropicClientService,
    ExtractFileService,
  ],
  exports: [PricelistImportsService],
})
export class PricelistImportsModule {}
