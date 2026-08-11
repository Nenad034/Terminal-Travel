import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { LanguageCode, ProductType, VisibleChannel } from '@prisma/client';

const PRODUCT_TYPES: ProductType[] = [
  'ACCOMMODATION',
  'PACKAGE',
  'TRANSFER',
  'EXCURSION',
  'FLIGHT',
  'INSURANCE',
  'TRANSPORT',
  'TICKET',
  'EVENT',
];

// M5 spec §11, GET /search. `type` je niz (multi-select, dopuna avgust 2026).
export class SearchQueryDto {
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsIn(PRODUCT_TYPES, { each: true })
  type?: ProductType[];

  @IsOptional() @IsString() destinationCountry?: string;
  @IsOptional() @IsString() destinationCity?: string;

  @IsOptional() @IsDateString() stayFrom?: string;
  @IsOptional() @IsDateString() stayTo?: string;

  // JSON string — isti oblik kao QuoteItem.occupancy (M5 spec §3.2a).
  @IsOptional() @IsString() occupancy?: string;

  @IsEnum(VisibleChannel)
  channel!: VisibleChannel;

  @IsOptional() @IsEnum(LanguageCode) lang?: LanguageCode;
}
