import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
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

  // M5 spec §11 v1.28 je ove parametre najavio za svih 8 dodatnih tipova (17.8.2026), ali nikad
  // nije stigao do ovog DTO-a — dopunjeno 22.8.2026 povodom rada na M17 popup pretrazi.
  // `trip_cost` (INSURANCE) je UKLONJEN iz spec-a 1.9.2026 (vlasnikova odluka) — M2 spec §2.3
  // eksplicitno kaže da NIJE svojstvo Product-a nego parametar ponude/kvota, filtriranje
  // PROIZVODA po njemu ne bi imalo smisla (svaka polisa bi "odgovarala" bilo kojoj vrednosti).
  @IsOptional() @IsString() cabinClass?: string; // FLIGHT — M2 spec §2.3 `attributes.cabin_class`

  // FLIGHT/TRANSFER/TRANSPORT — M5 spec §3.0d.1/3.0d.2/3.0d.3, dopuna 1.9.2026 (vlasnikova
  // odluka o konvenciji): `attributes.route.origin_city` za FLIGHT/TRANSFER/opšti TRANSPORT,
  // `attributes.pickup_location` za TRANSPORT/RENT_A_CAR (koji ima sopstvena imenovana polja).
  @IsOptional() @IsString() originCity?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  minDriverAge?: number; // TRANSPORT/RENT_A_CAR — M2 spec §2.3 `attributes.min_driver_age`

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  durationNights?: number; // CRUISE — M2 spec §2.3 `attributes.duration_nights`

  @IsOptional() @IsString() cabinType?: string; // CRUISE — poklapa `attributes.cabin_types[].category`

  // M5 spec §3.0c.3 (dopuna 26.8.2026) — ACCOMMODATION, poklapa `attributes.amenities[]` (M2
  // spec §2.3c `AmenityTag`), I-logika (svi traženi tagovi moraju biti prisutni).
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  amenityTags?: string[];
}
