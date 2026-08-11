import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { EventBusModule } from '../../../common/events/event-bus.module';

@Module({
  imports: [EventBusModule],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
