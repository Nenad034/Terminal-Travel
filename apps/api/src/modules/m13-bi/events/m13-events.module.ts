import { Module } from '@nestjs/common';
import { M13EventSubscribersService } from './m13-event-subscribers.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { FactSyncModule } from '../sync/fact-sync.module';

@Module({
  imports: [EventBusModule, FactSyncModule],
  providers: [M13EventSubscribersService],
})
export class M13EventsModule {}
