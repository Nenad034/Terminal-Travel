import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

// M7 spec §9 — POST /subagents/:id/approve: Vlasnik/Direktor postavlja kreditni limit uvek,
// i proviziju SAMO ako je subagent Tier 1 (parent_subagent_id IS NULL) — sprovedeno u servisu.
export class ApproveSubagentDto {
  @IsNumber()
  @Min(0)
  creditLimit!: number;

  @IsString()
  creditLimitCurrency!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage?: number;
}
