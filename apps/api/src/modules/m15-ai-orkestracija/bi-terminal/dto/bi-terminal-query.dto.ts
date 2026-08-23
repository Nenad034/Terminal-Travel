import { IsString, MinLength } from 'class-validator';

// M15 spec §6.9, §9 — POST /ai-orchestration/bi-terminal/query.
export class BiTerminalQueryDto {
  @IsString()
  @MinLength(1)
  query!: string;
}
