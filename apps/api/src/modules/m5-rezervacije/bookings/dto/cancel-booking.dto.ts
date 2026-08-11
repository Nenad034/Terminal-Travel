import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

// M5 spec §6/§6.4/§11 — POST /bookings/:id/cancel.
export class CancelBookingDto {
  // Ako nije poslato, otkazuju se sve aktivne stavke (CONFIRMED/PENDING_SUPPLIER_CONFIRMATION).
  @IsArray()
  @IsOptional()
  itemIds?: string[];

  // M5 spec §6.4/§11 — "poziv se ponavlja sa confirm_duplicate_override: true da bi se
  // otkazivanje ipak izvršilo" pošto je operater dobio upozorenje o mogućem duplikatu.
  @IsBoolean()
  @IsOptional()
  confirmDuplicateOverride?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}
