import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// M6 spec §3.1 — PATCH /loyalty-tiers/:id. Sva polja opciona.
export class UpdateLoyaltyTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  rank?: number;

  @IsOptional()
  @IsIn(['TOTAL_SPEND_RSD', 'BOOKING_COUNT', 'NIGHT_COUNT'])
  qualificationMetric?: 'TOTAL_SPEND_RSD' | 'BOOKING_COUNT' | 'NIGHT_COUNT';

  @IsOptional()
  @IsIn(['LIFETIME', 'ROLLING_12_MONTHS', 'CALENDAR_YEAR'])
  qualificationPeriod?: 'LIFETIME' | 'ROLLING_12_MONTHS' | 'CALENDAR_YEAR';

  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercentage?: number;

  @IsOptional()
  @IsString()
  benefitDescription?: string;
}
