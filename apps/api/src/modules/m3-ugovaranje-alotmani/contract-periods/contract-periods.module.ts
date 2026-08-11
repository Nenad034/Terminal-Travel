import { Module } from '@nestjs/common';
import { ContractPeriodsService } from './contract-periods.service';
import { ContractPeriodsController } from './contract-periods.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, EventBusModule],
  controllers: [ContractPeriodsController],
  providers: [ContractPeriodsService],
  exports: [ContractPeriodsService],
})
export class ContractPeriodsModule {}
