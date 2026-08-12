import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// M20 spec §2.3 — "Naziv/adresa/broj licence agencije", "Kontakt za hitne slučajeve" i "Rok za
// reklamacije na promenu cene" su statička pravna konfiguracija (konfigurabilna, ne hardkodovana
// prema spec tekstu), van modela podataka. Čita se iz env promenljivih sa razumnim podrazumevanim
// vrednostima — nema poseban DB entitet jer se menja retko i ručno (isti princip kao VAT_RATE_PERCENT
// konstanta u M10, samo podesivo preko env-a umesto koda).
@Injectable()
export class AgencyStaticConfigService {
  constructor(private readonly config: ConfigService) {}

  get(): {
    agencyName: string;
    agencyAddress: string;
    agencyLicenseNumber: string;
    emergencyContact: string;
    priceChangeComplaintDeadlineDays: number;
  } {
    return {
      agencyName: this.config.get<string>('AGENCY_NAME') ?? 'Terminal Travel',
      agencyAddress: this.config.get<string>('AGENCY_ADDRESS') ?? '(adresa nije podešena — AGENCY_ADDRESS)',
      agencyLicenseNumber: this.config.get<string>('AGENCY_LICENSE_NUMBER') ?? '(broj licence nije podešen — AGENCY_LICENSE_NUMBER)',
      emergencyContact: this.config.get<string>('AGENCY_EMERGENCY_CONTACT') ?? '(kontakt nije podešen — AGENCY_EMERGENCY_CONTACT)',
      priceChangeComplaintDeadlineDays: Number(this.config.get<string>('AGENCY_PRICE_CHANGE_COMPLAINT_DEADLINE_DAYS') ?? 8),
    };
  }
}
