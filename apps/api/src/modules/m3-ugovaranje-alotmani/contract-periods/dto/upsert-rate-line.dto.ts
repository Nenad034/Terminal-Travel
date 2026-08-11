import { IsArray, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AgeCategory, AgePricingMode, PriceBasis } from '@prisma/client';

// M3 spec §2.4a
export class AgePricingEntryDto {
  @IsEnum(AgeCategory)
  ageCategory!: AgeCategory;

  @IsInt()
  @IsOptional()
  occupantIndex?: number;

  @IsInt()
  @IsOptional()
  minAdultsPresent?: number;

  @IsEnum(AgePricingMode)
  pricingMode!: AgePricingMode;

  @IsOptional()
  percentage?: number;

  @IsInt()
  @IsOptional()
  flatPrice?: number;
}

// M3 spec §2.4
export class UpsertRateLineDto {
  @IsString()
  boardType!: string;

  @IsString()
  occupancy!: string;

  @IsEnum(PriceBasis)
  priceBasis!: PriceBasis;

  @IsInt()
  price!: number;

  @IsInt()
  @IsOptional()
  cribFeePerNight?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgePricingEntryDto)
  @IsOptional()
  agePricing?: AgePricingEntryDto[];
}
