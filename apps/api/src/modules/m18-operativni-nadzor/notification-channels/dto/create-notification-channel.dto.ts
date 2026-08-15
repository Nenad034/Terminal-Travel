import { IsEnum, IsObject, IsString } from 'class-validator';
import { NotificationChannelType } from '@prisma/client';

// M18 spec §3/§9 — POST /notification-channels. `config` je otvoren objekat (npr.
// { botToken, chatId } za TELEGRAM, { email } za EMAIL) — enkriptuje se pre upisa, isti
// obrazac kao M4 CreateProviderConfigDto/M12 CreateChannelConfigDto.
export class CreateNotificationChannelDto {
  @IsEnum(NotificationChannelType)
  channelType!: NotificationChannelType;

  @IsObject()
  config!: Record<string, unknown>;

  @IsString()
  recipientRole!: string;
}
