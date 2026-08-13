import { Module } from '@nestjs/common';
import { M14AlarmsService } from './m14-alarms.service';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [EventBusModule],
  providers: [M14AlarmsService],
  exports: [M14AlarmsService],
})
export class M14EventsModule {}
