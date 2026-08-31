import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { AncillaryPricingMode, AncillaryUnit } from '@prisma/client';

// M3 spec §2.6 — dopuna v1.12. `PUT` uvek KREIRA novi red (isti obrazac kao UpsertRateLineDto).
export class UpsertAncillaryServiceDto {
  @IsString()
  name!: string;

  @IsEnum(AncillaryPricingMode)
  pricingMode!: AncillaryPricingMode;

  @ValidateIf((o: UpsertAncillaryServiceDto) => o.pricingMode === 'FLAT_PER_UNIT')
  @IsInt()
  flatAmount?: number;

  @ValidateIf((o: UpsertAncillaryServiceDto) => o.pricingMode === 'PERCENTAGE_OF_NIGHTLY_RATE')
  @IsNumber()
  percentageOfNightlyRate?: number;

  @IsEnum(AncillaryUnit)
  unit!: AncillaryUnit;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  isRefundable?: boolean;

  @IsInt()
  @IsOptional()
  maxQuantity?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
