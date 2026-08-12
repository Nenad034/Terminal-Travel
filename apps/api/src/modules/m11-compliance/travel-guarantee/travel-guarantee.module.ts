import { Module } from '@nestjs/common';
import { TravelGuaranteeService } from './travel-guarantee.service';
import { TravelGuaranteeController } from './travel-guarantee.controller';
import { AuditLogModule } from '../../m1-core-identitet/audit-log/audit-log.module';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { ExchangeRatesModule } from '../../m10-finansije/exchange-rates/exchange-rates.module';

@Module({
  imports: [AuditLogModule, AuthModule, PermissionsModule, EventBusModule, ExchangeRatesModule],
  controllers: [TravelGuaranteeController],
  providers: [TravelGuaranteeService],
  exports: [TravelGuaranteeService],
})
export class TravelGuaranteeModule {}
