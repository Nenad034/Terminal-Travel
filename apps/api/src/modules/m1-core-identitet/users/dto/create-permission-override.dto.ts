import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { PermissionEffect } from '@prisma/client';

// M1 spec §7 — forma ne dozvoljava slanje bez razloga.
export class CreatePermissionOverrideDto {
  @IsUUID()
  permissionId!: string;

  @IsEnum(PermissionEffect)
  effect!: PermissionEffect;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
