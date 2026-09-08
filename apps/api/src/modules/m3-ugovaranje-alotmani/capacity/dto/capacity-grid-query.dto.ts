import { IsBooleanString, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { AllotmentMode } from '@prisma/client';

/** M3 spec §2.8/§6 — filteri mreže kapaciteta. Raspon je ograničen na kvartal (u servisu). */
export class CapacityGridQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsUUID()
  @IsOptional()
  contractId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  roomType?: string;

  @IsEnum(AllotmentMode)
  @IsOptional()
  allotmentMode?: AllotmentMode;

  /** Podrazumevano se prikazuju samo ACTIVE ugovori — nacrti nisu prodajni. */
  @IsBooleanString()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDraftContracts?: boolean;
}
