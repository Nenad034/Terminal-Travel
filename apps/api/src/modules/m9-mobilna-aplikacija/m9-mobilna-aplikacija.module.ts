import { Module } from '@nestjs/common';
import { FieldStaffModule } from './field-staff/field-staff.module';
import { PushTokenModule } from './push-token/push-token.module';
import { GuestDocumentScanModule } from './guest-document-scan/guest-document-scan.module';

// docs/moduli/M09-mobilna-aplikacija/16-SPECIFIKACIJA-M9-MOBILNA-APLIKACIJA.md
// Backend za deo vodiča na terenu (§3/§4) + push token registracija (§5, v1.4, zajednička
// gostu i vodiču). Deo za goste (§2) inače nema sopstveni kod, isti API-ji kao M8 — izuzetak
// je §2a (dopuna 2.9.2026, skeniranje pasoša), koje zahteva kameru uređaja i zato prvi put
// dobija sopstvenu M9 rutu.
@Module({
  imports: [FieldStaffModule, PushTokenModule, GuestDocumentScanModule],
})
export class M9MobilnaAplikacijaModule {}
