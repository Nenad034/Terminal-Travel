import { Module } from '@nestjs/common';
import { M6EventSubscribersService } from './m6-event-subscribers.service';
import { M6TriggersService } from './m6-triggers.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { PostTripSurveysModule } from '../post-trip-surveys/post-trip-surveys.module';

@Module({
  imports: [EventBusModule, LoyaltyModule, PostTripSurveysModule],
  providers: [M6EventSubscribersService, M6TriggersService],
})
export class M6EventsModule {}
