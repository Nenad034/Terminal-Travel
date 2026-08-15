import { IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

// M18 spec §9 — PATCH /ai-provider-quota/:id. Menja samo konfiguraciju (limiti/prag), nikad
// consumed/consumedEur/enforcementState direktno — ti se menjaju isključivo kroz stvarnu
// potrošnju (AgentInvocationLogService) ili kroz POST /:id/override (enforcementState).
export class UpdateAiProviderQuotaDto {
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
