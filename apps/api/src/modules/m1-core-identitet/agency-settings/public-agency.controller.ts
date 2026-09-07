import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AgencySettingsService } from './agency-settings.service';
import { Public } from '../../../common/decorators/public.decorator';

/**
 * JAVAN endpoint (M1 spec §3.9c i §3.7a) — javni sajt (M8) čita naziv agencije za naslov
 * stranice i podnožje, a poziva ga pre nego što iko postoji da bi bio prijavljen.
 *
 * Šta ga štiti umesto tokena: sam odgovor. `getPublic()` vraća ISKLJUČIVO polja koja ionako
 * stoje na dnu javnog sajta (naziv, email, telefon, adresa, sajt) — `taxId` i `licenseNumber`
 * ne izlaze odavde nikad. Isti princip razdvojenog javnog oblika kao M2 `public-products`.
 */
@ApiTags('agency-settings')
@Controller('iam/public/agency')
export class PublicAgencyController {
  constructor(private readonly settings: AgencySettingsService) {}

  @Public()
  @Get()
  get() {
    return this.settings.getPublic();
  }
}
