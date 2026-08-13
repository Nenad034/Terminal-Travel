import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// M7 spec §10 (M7/subagent/EDIT) — izmena kreditnog limita/statusa od strane Vlasnik/Direktor.
// commission_percentage se NAMERNO ne menja ovde — Tier 1 provizija se postavlja pri approve(),
// sub-subagent provizija isključivo preko PATCH .../commission (§3 ograda).
export class UpdateSubagentDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @IsOptional()
  @IsString()
  creditLimitCurrency?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';
}
