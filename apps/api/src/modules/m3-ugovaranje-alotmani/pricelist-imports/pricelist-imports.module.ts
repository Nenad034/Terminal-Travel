import { Module } from '@nestjs/common';
import { PricelistImportsService } from './pricelist-imports.service';
import { PricelistExtractionService } from './pricelist-extraction.service';
import { PricelistImportsController } from './pricelist-imports.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { M18OperativniNadzorModule } from '../../m18-operativni-nadzor/m18-operativni-nadzor.module';
import { AnthropicClientService } from '../../m15-ai-orkestracija/anthropic/anthropic-client.service';

// M3 §4.2.6 (9.9.2026) — AI ekstrakcija cenovnika. M18OperativniNadzorModule zbog
// AgentInvocationLogService (svaki poziv jezičkom modelu se beleži). AnthropicClientService nije
// izvezen iz M15 modula (samo registrovan lokalno tamo) i zavisi isključivo od globalnog
// ConfigService, pa se ovde registruje kao sopstven provider umesto uvoza celog M15 modula —
// isti minimalan-DI princip koji M19 već koristi za SupplierDraftService.
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, M18OperativniNadzorModule],
  controllers: [PricelistImportsController],
  providers: [PricelistImportsService, PricelistExtractionService, AnthropicClientService],
  exports: [PricelistImportsService],
})
export class PricelistImportsModule {}
