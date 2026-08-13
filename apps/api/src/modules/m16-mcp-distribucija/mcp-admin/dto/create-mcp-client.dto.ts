import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { McpAccessLevel } from '@prisma/client';

// M16 spec §3.1 — POST /mcp-admin/clients.
export class CreateMcpClientDto {
  @IsString()
  clientName!: string;

  @IsEnum(McpAccessLevel)
  @IsOptional()
  accessLevel?: McpAccessLevel;

  @IsInt()
  @Min(1)
  @IsOptional()
  rateLimitPerMinute?: number;
}
