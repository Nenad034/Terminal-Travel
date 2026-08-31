import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { OfferDiscountType, PricelistOfferType } from '@prisma/client';

// M3 spec §2.4b — dopuna v1.12. `PUT` uvek KREIRA novi red (isti obrazac kao UpsertRateLineDto).
export class UpsertOfferDto {
  @IsEnum(PricelistOfferType)
  offerType!: PricelistOfferType;

  @IsDateString()
  bookingFrom!: string;

  @IsDateString()
  bookingTo!: string;

  // samo EARLY_BOOKING
  @ValidateIf((o: UpsertOfferDto) => o.offerType === 'EARLY_BOOKING')
  @IsEnum(OfferDiscountType)
  discountType?: OfferDiscountType;

  @ValidateIf((o: UpsertOfferDto) => o.discountType === 'PERCENTAGE')
  @IsNumber()
  discountPercentage?: number;

  @ValidateIf((o: UpsertOfferDto) => o.discountType === 'FIXED_AMOUNT')
  @IsInt()
  discountAmount?: number;

  // samo FREE_NIGHTS
  @ValidateIf((o: UpsertOfferDto) => o.offerType === 'FREE_NIGHTS')
  @IsInt()
  stayNights?: number;

  @ValidateIf((o: UpsertOfferDto) => o.offerType === 'FREE_NIGHTS')
  @IsInt()
  payNights?: number;

  @IsNumber()
  @IsOptional()
  depositPercentage?: number;

  @IsDateString()
  @IsOptional()
  depositDeadline?: string;

  @IsNumber()
  @IsOptional()
  minAge?: number;

  @IsNumber()
  @IsOptional()
  maxAge?: number;

  @IsArray()
  @IsOptional()
  validArrivalWeekdays?: number[];

  @IsArray()
  @IsOptional()
  excludedRoomTypes?: string[];

  @IsBoolean()
  @IsOptional()
  combinableWithOtherOffers?: boolean;
}
