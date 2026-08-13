import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// M7 spec §3.1 — PATCH /subagents/:id/volume-tiers/:tierId.
export class UpdateVolumeTierDto {
  @IsOptional()
  @IsNumber()
  rank?: number;

  @IsOptional()
  @IsIn(['TOTAL_SALES_RSD', 'BOOKING_COUNT', 'NIGHT_COUNT'])
  thresholdMetric?: 'TOTAL_SALES_RSD' | 'BOOKING_COUNT' | 'NIGHT_COUNT';

  @IsOptional()
  @IsIn(['CALENDAR_QUARTER', 'CALENDAR_YEAR', 'ROLLING_12_MONTHS'])
  thresholdPeriod?: 'CALENDAR_QUARTER' | 'CALENDAR_YEAR' | 'ROLLING_12_MONTHS';

  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  resultingCommissionPercentage?: number;

  @IsOptional()
  @IsNumber()
  resultingCommissionFixedAmount?: number;

  @IsOptional()
  @IsString()
  resultingCommissionCurrency?: string;

  @IsOptional()
  @IsBoolean()
  retroactive?: boolean;
}
