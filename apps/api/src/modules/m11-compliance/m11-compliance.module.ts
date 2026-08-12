import { Module } from '@nestjs/common';
import { TravelGuaranteeModule } from './travel-guarantee/travel-guarantee.module';
import { TravelGuaranteeRegistrationsModule } from './travel-guarantee-registrations/travel-guarantee-registrations.module';
import { InspectionExportModule } from './inspection-export/inspection-export.module';
import { M11EventsModule } from './events/m11-events.module';

// docs/moduli/M11-compliance/08-SPECIFIKACIJA-M11-COMPLIANCE.md
@Module({
  imports: [TravelGuaranteeModule, TravelGuaranteeRegistrationsModule, InspectionExportModule, M11EventsModule],
  exports: [TravelGuaranteeModule],
})
export class M11ComplianceModule {}
