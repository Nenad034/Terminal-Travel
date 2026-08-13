import { Module } from '@nestjs/common';
import { M7EventSubscribersService } from './m7-event-subscribers.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { CommissionModule } from '../commission/commission.module';

@Module({
  imports: [EventBusModule, CommissionModule],
  providers: [M7EventSubscribersService],
})
export class M7EventsModule {}
