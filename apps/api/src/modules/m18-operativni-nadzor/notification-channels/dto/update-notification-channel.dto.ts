import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationChannelStatus } from '@prisma/client';

// M18 spec §9 — PATCH /notification-channels/:id.
export class UpdateNotificationChannelDto {
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  recipientRole?: string;

  @IsEnum(NotificationChannelStatus)
  @IsOptional()
  status?: NotificationChannelStatus;
}
