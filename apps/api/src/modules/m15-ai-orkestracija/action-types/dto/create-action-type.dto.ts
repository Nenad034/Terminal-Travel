import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AgentActionTier } from '@prisma/client';

// M15 spec §4/§9 — registar akcija, ("globalno") red ima moduleCode = null (nije poslato u telu).
export class CreateActionTypeDto {
  @IsOptional()
  @IsString()
  moduleCode?: string;

  @IsString()
  @IsNotEmpty()
  actionCode!: string;

  @IsEnum(AgentActionTier)
  tier!: AgentActionTier;

  @IsString()
  @IsNotEmpty()
  sourceNote!: string;
}
