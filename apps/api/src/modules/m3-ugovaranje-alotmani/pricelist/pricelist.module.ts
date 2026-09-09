import { Module } from '@nestjs/common';
import { PricelistService } from './pricelist.service';
import { PricelistController } from './pricelist.controller';
import { PricelistVersionsService } from './pricelist-versions.service';
import { PricelistVersionsController } from './pricelist-versions.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

// M3 spec §2.11 (v1.27) — cenovnik kao mreža; §2.11l (v1.33) — verzije cenovnika.
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [PricelistController, PricelistVersionsController],
  providers: [PricelistService, PricelistVersionsService],
  exports: [PricelistService, PricelistVersionsService],
})
export class PricelistModule {}
