import { Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { EventListenerService } from './event-listener.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EventBusService, EventListenerService],
  exports: [EventBusService, EventListenerService],
})
export class EventBusModule {}
