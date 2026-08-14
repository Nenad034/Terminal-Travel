import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AgentActionTier } from '@prisma/client';

export class UpdateActionTypeDto {
  @IsOptional()
  @IsEnum(AgentActionTier)
  tier?: AgentActionTier;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceNote?: string;
}
