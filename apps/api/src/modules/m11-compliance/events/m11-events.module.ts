import { Module } from '@nestjs/common';
import { M11EventSubscribersService } from './m11-event-subscribers.service';
import { M11AlarmsService } from './m11-alarms.service';
import { EventBusModule } from '../../../common/events/event-bus.module';
import { TravelGuaranteeModule } from '../travel-guarantee/travel-guarantee.module';
import { TravelGuaranteeRegistrationsModule } from '../travel-guarantee-registrations/travel-guarantee-registrations.module';

@Module({
  imports: [EventBusModule, TravelGuaranteeModule, TravelGuaranteeRegistrationsModule],
  providers: [M11EventSubscribersService, M11AlarmsService],
})
export class M11EventsModule {}
