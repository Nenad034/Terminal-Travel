import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { LanguageCode, ProductType, VisibleChannel } from '@prisma/client';

// M5 spec §11 — `channel` filtrira po `Product.visible_channels` (samo B2C_SITE/B2B_PORTAL/
// MOBILE, M2 spec §2.1) ZA javne/samouslužne kanale. `INTERNAL_PANEL` je dodat ovde (avgust
// 2026, otkriveno pri implementaciji M17) — tim mora da vidi SVAKI ACTIVE proizvod bez obzira
// na visible_channels (M2 spec §5.1: to polje kontroliše samo gde se proizvod PRIKAZUJE
// gostima/subagentima, ne interni pristup) — SearchService preskače visibleChannels filter za
// ovu vrednost. Pošto je GET /search namerno bez guard-a (§11 dopuna, javna M8 pretraga),
// SearchController ručno proverava JWT + M5/booking/VIEW SAMO kad je channel=INTERNAL_PANEL,
// da ova vrednost ne postane rupa za anonimne pozive.
export type SearchChannel = VisibleChannel | 'INTERNAL_PANEL';
const SEARCH_CHANNELS: SearchChannel[] = ['B2C_SITE', 'B2B_PORTAL', 'MOBILE', 'INTERNAL_PANEL'];

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
  'CRUISE',
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

  @IsIn(SEARCH_CHANNELS)
  channel!: SearchChannel;

  @IsOptional() @IsEnum(LanguageCode) lang?: LanguageCode;
}
