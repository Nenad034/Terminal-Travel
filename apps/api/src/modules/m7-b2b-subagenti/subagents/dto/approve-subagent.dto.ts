import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

// M7 spec §2.0.7 (31.8.2026) — bira isključivo Vlasnik/Direktor pri odobravanju, nikad subagent sam.
export enum SubagentPrivilegeLevelDto {
  STANDARD = 'STANDARD',
  FRANCHISE = 'FRANCHISE',
}

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

  @IsOptional()
  @IsEnum(SubagentPrivilegeLevelDto)
  privilegeLevel?: SubagentPrivilegeLevelDto;
}
