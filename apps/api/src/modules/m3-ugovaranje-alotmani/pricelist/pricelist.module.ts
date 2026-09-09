import { Module } from '@nestjs/common';
import { PricelistService } from './pricelist.service';
import { PricelistController } from './pricelist.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

// M3 spec §2.11 (v1.27) — cenovnik kao mreža.
@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [PricelistController],
  providers: [PricelistService],
  exports: [PricelistService],
})
export class PricelistModule {}
