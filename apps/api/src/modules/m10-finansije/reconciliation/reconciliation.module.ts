import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { AuthModule } from '../../m1-core-identitet/auth/auth.module';
import { PermissionsModule } from '../../m1-core-identitet/permissions/permissions.module';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [AuthModule, PermissionsModule, EventBusModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
