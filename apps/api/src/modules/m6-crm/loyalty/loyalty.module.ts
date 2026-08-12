import { Module } from '@nestjs/common';
import { LoyaltyTiersService } from './loyalty-tiers.service';
import { ClientLoyaltyStatusService } from './client-loyalty-status.service';
import { LoyaltyController } from './loyalty.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyTiersService, ClientLoyaltyStatusService],
  exports: [LoyaltyTiersService, ClientLoyaltyStatusService],
})
export class LoyaltyModule {}
