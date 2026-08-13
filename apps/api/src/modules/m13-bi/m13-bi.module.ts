import { Module } from '@nestjs/common';
import { ReportsModule } from './reports/reports.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { FactSyncModule } from './sync/fact-sync.module';
import { M13EventsModule } from './events/m13-events.module';

// docs/moduli/M13-bi/13-SPECIFIKACIJA-M13-BI.md
@Module({
  imports: [FactSyncModule, ReportsModule, ReconciliationModule, M13EventsModule],
  exports: [FactSyncModule, ReportsModule, ReconciliationModule],
})
export class M13BiModule {}
