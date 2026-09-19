import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { M5Channel, ProductType } from '@prisma/client';

// M5 spec §3.2a — room_config[] po sobi.
export class RoomConfigInputDto {
  @IsString()
  @IsOptional()
  roomTypeCode?: string | null;

  @IsInt()
  @Min(0)
  adults!: number;

  @IsInt()
  @Min(0)
  children!: number;

  @IsArray()
  @IsOptional()
  childrenAges?: number[] | null;
}

// M5 spec §3.2a — occupancy = {adults, children, room_config[]}.
export class OccupancyInputDto {
  @IsInt()
  @Min(0)
  adults!: number;

  @IsInt()
  @Min(0)
  children!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoomConfigInputDto)
  @IsOptional()
  roomConfig?: RoomConfigInputDto[];
}

// M5 spec §3.0j.3/§3.0j.4 (v2.53) — ručna stavka ponude: proizvod kog nema u katalogu (ili nema
// cenu za period). Pravi DRAFT proizvod (§6.7b) + MANUAL stavku bez pravila marže.
export class ManualQuoteItemDto {
  @IsEnum(ProductType)
  productType!: ProductType;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  supplierId!: string;

  @IsString()
  destinationCountry!: string;

  @IsString()
  destinationCity!: string;

  /** Najmanja jedinica valute; null kad još nije dogovorena (budžet klijenta, §3.0j.7 t. 1). */
  @IsInt()
  @Min(0)
  @IsOptional()
  baseCost?: number | null;

  @IsInt()
  @Min(0)
  finalPrice!: number;

  @IsString()
  currency!: string;

  @IsBoolean()
  @IsOptional()
  saveToCatalog?: boolean;

  /** §3.0j.7 t. 3 — odobren predlog sa zvaničnog sajta (opis/adresa/kategorija/sadržaji). */
  @IsOptional()
  attributes?: Record<string, unknown> | null;

  @IsString()
  @IsOptional()
  notes?: string;
}

// M5 spec §3.0b.3 — polja se prepisuju iz izabranog SearchResultOffer, jedna stavka Ponude.
export class CreateQuoteItemDto {
  /** Prazno samo uz `manual` (§3.0j) — inače obavezno. */
  @ValidateIf((o: CreateQuoteItemDto) => !o.manual)
  @IsString()
  productId?: string;

  @ValidateNested()
  @Type(() => ManualQuoteItemDto)
  @IsOptional()
  manual?: ManualQuoteItemDto;

  @IsString()
  @IsOptional()
  rateLineId?: string;

  @IsString()
  @IsOptional()
  providerQuoteReference?: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @ValidateNested()
  @Type(() => OccupancyInputDto)
  occupancy!: OccupancyInputDto;

  // M5 spec §3.0b.3 korak 4 — quote_expires_at izabranog SearchResultOffer (samo API stavke).
  @IsDateString()
  @IsOptional()
  selectedOfferQuoteExpiresAt?: string;
}

// M5 spec §3.1/§11 — POST /quotes.
export class CreateQuoteDto {
  @IsEnum(M5Channel)
  channel!: M5Channel;

  @IsString()
  @IsOptional()
  clientAccountId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items!: CreateQuoteItemDto[];

  @IsBoolean()
  @IsOptional()
  contractTermsAccepted?: boolean;

  @IsString()
  @IsOptional()
  referralTrackingCode?: string;

  // M5 spec §3.0e.3a (dopuna 29.8.2026) — eksplicitna potvrda da su neusklađeni datumi
  // PREVOZ/BORAVAK stavki namerni; bez ovoga server odbija kreiranje kad je neusklađenost nađena.
  @IsBoolean()
  @IsOptional()
  dateMismatchAcknowledged?: boolean;

  /** §3.0j.2 — nalepljen mejl/zahtev iz kog je nacrt nastao; čuva se uz ponudu. */
  @IsString()
  @IsOptional()
  intakeSourceText?: string;

  /** §3.0k.3 — `X-Search-Id` iz `GET /search` odgovora; spaja upit sa ponudom (lijevak). */
  @IsUUID()
  @IsOptional()
  searchLogId?: string;
}
