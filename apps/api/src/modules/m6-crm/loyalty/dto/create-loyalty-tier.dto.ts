import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// M6 spec §3.1 — POST /loyalty-tiers.
export class CreateLoyaltyTierDto {
  @IsString()
  name!: string;

  @IsInt()
  rank!: number;

  @IsIn(['TOTAL_SPEND_RSD', 'BOOKING_COUNT', 'NIGHT_COUNT'])
  qualificationMetric!: 'TOTAL_SPEND_RSD' | 'BOOKING_COUNT' | 'NIGHT_COUNT';

  @IsIn(['LIFETIME', 'ROLLING_12_MONTHS', 'CALENDAR_YEAR'])
  qualificationPeriod!: 'LIFETIME' | 'ROLLING_12_MONTHS' | 'CALENDAR_YEAR';

  @IsNumber()
  @Min(0)
  threshold!: number;

  @IsNumber()
  @Min(0)
  discountPercentage!: number;

  @IsOptional()
  @IsString()
  benefitDescription?: string;
}
