import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgencySettingsService } from '../../m1-core-identitet/agency-settings/agency-settings.service';

// M20 spec §2.3 — "Naziv/adresa/broj licence agencije", "Kontakt za hitne slučajeve" i "Rok za
// reklamacije na promenu cene" su statička pravna konfiguracija, van modela podataka.
//
// IZMENA 7.9.2026 (M1 spec §3.9c): izvor istine je sad `AgencySettings` u bazi, koji se menja
// kroz ekran u panelu — ranije su to bile isključivo env promenljive, pa se naziv agencije nije
// mogao promeniti bez pristupa serveru. Env ostaje kao REZERVA, namerno: na svežem serveru,
// pre nego što iko otvori panel, ugovor sa gostom mora da ima ime agencije na sebi.
//
// Redosled izvora: baza → env → vidljiva oznaka "nije podešeno". Poslednje je namerno vidljivo,
// a ne prazan string: ugovor bez broja licence je pravni problem koji mora da bode oči, ne da
// tiho nedostaje.
@Injectable()
export class AgencyStaticConfigService {
  constructor(
    private readonly config: ConfigService,
    private readonly agencySettings: AgencySettingsService,
  ) {}

  async get(): Promise<{
    agencyName: string;
    agencyAddress: string;
    agencyLicenseNumber: string;
    emergencyContact: string;
    priceChangeComplaintDeadlineDays: number;
  }> {
    const iz = await this.agencySettings.get();

    // `legalName` ima prednost nad `brandName` — na ugovoru stoji pravno ime firme, koje ne
    // mora biti isto što i ime pod kojim se agencija reklamira (M1 spec §3.9c).
    const naziv = iz.legalName?.trim() || iz.brandName?.trim();

    return {
      agencyName: naziv || (this.config.get<string>('AGENCY_NAME') ?? 'Terminal Travel'),
      agencyAddress:
        iz.address?.trim() ||
        this.config.get<string>('AGENCY_ADDRESS') ||
        '(adresa nije podešena — Podešavanja → Podaci agencije)',
      agencyLicenseNumber:
        iz.licenseNumber?.trim() ||
        this.config.get<string>('AGENCY_LICENSE_NUMBER') ||
        '(broj licence nije podešen — Podešavanja → Podaci agencije)',
      emergencyContact:
        iz.emergencyContact?.trim() ||
        this.config.get<string>('AGENCY_EMERGENCY_CONTACT') ||
        '(kontakt nije podešen — Podešavanja → Podaci agencije)',
      priceChangeComplaintDeadlineDays: Number(
        this.config.get<string>('AGENCY_PRICE_CHANGE_COMPLAINT_DEADLINE_DAYS') ?? 8,
      ),
    };
  }
}
