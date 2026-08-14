import { Module } from '@nestjs/common';
import { FieldStaffModule } from './field-staff/field-staff.module';

// docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md
// Namerno uzak obim (avgust 2026, potvrđeno vlasnikom) — samo backend za deo vodiča na
// terenu (§3/§4). Deo za goste (§2) nema sopstveni kod, isti API-ji kao M8.
@Module({
  imports: [FieldStaffModule],
})
export class M9MobilnaAplikacijaModule {}
