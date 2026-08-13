import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { ContentChannel } from '@prisma/client';

// M12 spec §4/§7 — POST /channels. authConfig je otvoren objekat (npr. { pageId, accessToken }
// za FACEBOOK/INSTAGRAM) — enkriptuje se pre upisa, isti obrazac kao M4 CreateProviderConfigDto.
// M8_SITE/MOBILE_PUSH nemaju sopstveni adapter (§4) pa authConfig ostaje nepotreban za njih,
// ali DTO ga ne zabranjuje — servis ga jednostavno ne koristi za te kanale.
export class CreateChannelConfigDto {
  @IsEnum(ContentChannel)
  channelCode!: ContentChannel;

  @IsString()
  displayName!: string;

  @IsObject()
  @IsOptional()
  authConfig?: Record<string, unknown>;
}
