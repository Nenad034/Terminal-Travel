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
  Min,
  ValidateNested,
} from 'class-validator';
import { M5Channel } from '@prisma/client';

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

// M5 spec §3.0b.3 — polja se prepisuju iz izabranog SearchResultOffer, jedna stavka Ponude.
export class CreateQuoteItemDto {
  @IsString()
  productId!: string;

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
}
