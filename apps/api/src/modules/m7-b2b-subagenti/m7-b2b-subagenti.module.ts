import { Module } from '@nestjs/common';
import { SubagentsModule } from './subagents/subagents.module';
import { CommissionModule } from './commission/commission.module';
import { M7EventsModule } from './events/m7-events.module';

// docs/moduli/M07-b2b-subagenti/12-SPECIFIKACIJA-M7-B2B-SUBAGENTI.md
@Module({
  imports: [SubagentsModule, CommissionModule, M7EventsModule],
  exports: [SubagentsModule, CommissionModule],
})
export class M7B2bSubagentiModule {}
