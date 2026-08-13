import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ChannelConfigStatus } from '@prisma/client';

// M12 spec §7 — PATCH /channels/:code.
export class UpdateChannelConfigDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsObject()
  @IsOptional()
  authConfig?: Record<string, unknown>;

  @IsEnum(ChannelConfigStatus)
  @IsOptional()
  status?: ChannelConfigStatus;
}
