import { Module } from '@nestjs/common';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { NbsRateFetcherService } from './nbs-rate-fetcher.service';
import { NbsRateImportCron } from './nbs-rate-import.cron';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuthModule, PermissionsModule, EventBusModule],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, NbsRateFetcherService, NbsRateImportCron],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
