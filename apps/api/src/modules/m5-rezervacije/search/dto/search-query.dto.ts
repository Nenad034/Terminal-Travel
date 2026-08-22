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
  // nije stigao do ovog DTO-a — dopunjeno 22.8.2026 povodom rada na M17 popup pretrazi. `origin_city`
  // i `trip_cost` NAMERNO nisu dodati ovde: `origin_city` bi filtrirao ugnježđen `attributes.route`
  // objekat čiji tačan oblik podataka (`route.origin` vs. neki drugi naziv ključa) M2 spec §2.3 nikad
  // nije precizirao za FLIGHT/TRANSFER/TRANSPORT (samo kaže "strukturirano polazište/odredište");
  // `trip_cost` (INSURANCE) M2 spec §2.3 eksplicitno kaže da NIJE svojstvo Product-a nego parametar
  // ponude/kvota — filtriranje PROIZVODA po njemu ne bi imalo smisla (svaka polisa bi "odgovarala"
  // bilo kojoj vrednosti). Oba ostaju otvorena u `docs/analize/27-BACKLOG-IDEJA-I-PREDLOZI.md` (M5).
  @IsOptional() @IsString() cabinClass?: string; // FLIGHT — M2 spec §2.3 `attributes.cabin_class`

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
}
