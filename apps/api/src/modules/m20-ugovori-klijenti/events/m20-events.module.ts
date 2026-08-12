import { Module } from '@nestjs/common';
import { M20EventSubscribersService } from './m20-event-subscribers.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { ClientContractsModule } from '../client-contracts/client-contracts.module';

@Module({
  imports: [EventBusModule, ClientContractsModule],
  providers: [M20EventSubscribersService],
})
export class M20EventsModule {}
