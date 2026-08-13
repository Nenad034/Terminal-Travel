import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// M7 spec §3.1 — POST /subagents/:id/volume-tiers. Bar jedno od resultingCommissionPercentage/
// resultingCommissionFixedAmount mora biti postavljeno (isti obrazac kao M5 MarkupRule) —
// provereno u servisu, ne ovde (zavisi od kombinacije dva opciona polja).
export class CreateVolumeTierDto {
  @IsNumber()
  rank!: number;

  @IsIn(['TOTAL_SALES_RSD', 'BOOKING_COUNT', 'NIGHT_COUNT'])
  thresholdMetric!: 'TOTAL_SALES_RSD' | 'BOOKING_COUNT' | 'NIGHT_COUNT';

  @IsIn(['CALENDAR_QUARTER', 'CALENDAR_YEAR', 'ROLLING_12_MONTHS'])
  thresholdPeriod!: 'CALENDAR_QUARTER' | 'CALENDAR_YEAR' | 'ROLLING_12_MONTHS';

  @IsNumber()
  @Min(0)
  thresholdValue!: number;

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
