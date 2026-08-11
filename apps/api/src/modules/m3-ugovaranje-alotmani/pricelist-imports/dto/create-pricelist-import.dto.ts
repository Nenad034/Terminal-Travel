import { IsEnum, IsString, IsUUID } from 'class-validator';
import { PricelistSourceFormat } from '@prisma/client';

// M3 spec §4.2.1
export class CreatePricelistImportDto {
  @IsUUID()
  supplierId!: string;

  @IsString()
  sourceFileUrl!: string;

  @IsEnum(PricelistSourceFormat)
  sourceFormat!: PricelistSourceFormat;
}
