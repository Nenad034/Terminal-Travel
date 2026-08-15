import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { QuotaPeriod } from '@prisma/client';

// M18 spec §6.4/§6.5/§9 — POST /ai-provider-quota. quota_limit/budget_limit_eur su namerno
// opcioni (§11 — "poslovna odluka vlasnika pri implementaciji, ne pretpostavlja se u
// specifikaciji") — red se sme kreirati i bez njih (samo prati potrošnju, bez alarma/degradacije
// dok vlasnik ne unese vrednost preko PATCH-a).
export class CreateAiProviderQuotaDto {
  @IsString()
  providerName!: string;

  @IsEnum(QuotaPeriod)
  period!: QuotaPeriod;

  @IsInt()
  @IsPositive()
  @IsOptional()
  quotaLimit?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  budgetLimitEur?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  alertThresholdPercentage?: number;
}
