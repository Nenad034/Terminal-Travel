import { Module } from '@nestjs/common';
import { TicketsModule } from './tickets/tickets.module';
import { M14EventsModule } from './events/m14-events.module';

// docs/moduli/M14-helpdesk/14-SPECIFIKACIJA-M14-HELPDESK.md
@Module({
  imports: [TicketsModule, M14EventsModule],
  exports: [TicketsModule],
})
export class M14HelpdeskModule {}
