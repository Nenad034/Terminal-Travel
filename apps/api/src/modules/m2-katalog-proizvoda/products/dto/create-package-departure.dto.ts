import { IsDateString } from 'class-validator';

// M5 spec §3.0d.6 (v1.94) — jedini ulaz je datum polaska; `return_date` se računa na serveru
// iz Product.attributes.duration_days (poglavlje 2.3e), ne prima se kao ulaz.
export class CreatePackageDepartureDto {
  @IsDateString()
  departureDate!: string;
}
