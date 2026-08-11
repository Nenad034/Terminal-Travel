import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { VisibleChannel } from '@prisma/client';

// M2 spec §7 — POST /products/:id/publish: "menja status u ACTIVE i/ili visible_channels".
export class PublishProductDto {
  @IsArray()
  @IsEnum(VisibleChannel, { each: true })
  @IsOptional()
  visibleChannels?: VisibleChannel[];
}
