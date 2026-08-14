import { Module } from '@nestjs/common';
import { FieldStaffModule } from './field-staff/field-staff.module';
import { PushTokenModule } from './push-token/push-token.module';

// docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md
// Backend za deo vodiča na terenu (§3/§4) + push token registracija (§5, v1.4, zajednička
// gostu i vodiču). Deo za goste (§2) inače nema sopstveni kod, isti API-ji kao M8.
@Module({
  imports: [FieldStaffModule, PushTokenModule],
})
export class M9MobilnaAplikacijaModule {}
