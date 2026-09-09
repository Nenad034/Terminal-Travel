import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AllotmentMode, ProductType } from '@prisma/client';

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

  /**
   * §6 (dopuna v1.22) — filteri nad vezanim `Product` (M2): destinacija, naziv objekta i vrsta
   * proizvoda. Do v1.22 su stajali u opisu endpoint-a, ali ih kod nije imao; ekran M17 §4b.3 ih
   * traži. Tekstualna polja porede se "sadrži, bez obzira na velika slova" — isti obrazac kao
   * isti filteri na `GET /sales/bookings` (M5 §11), da se dva ekrana ne ponašaju različito nad
   * istom rečju.
   */
  @IsString()
  @IsOptional()
  destinationCountry?: string;

  @IsString()
  @IsOptional()
  destinationCity?: string;

  @IsString()
  @IsOptional()
  productName?: string;

  /**
   * Više vrednosti odjednom — panel šalje ponovljen parametar (`?productType=A&productType=B`),
   * što Nest/Express daje kao `string[]`; jedna vrednost stiže kao `string`. `@Transform` svodi
   * oba oblika na niz pre validacije, isti obrazac kao multiselect filteri M5 liste.
   */
  @IsEnum(ProductType, { each: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  productType?: ProductType[];

  /** Podrazumevano se prikazuju samo ACTIVE ugovori — nacrti nisu prodajni. */
  @IsBooleanString()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDraftContracts?: boolean;
}
