import { IsEnum, IsOptional, IsString } from 'class-validator';
import { M5Channel } from '@prisma/client';

// M5 spec §3.0.1
export class CreateItineraryDto {
  @IsEnum(M5Channel)
  channel!: M5Channel;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  clientAccountId?: string;
}
