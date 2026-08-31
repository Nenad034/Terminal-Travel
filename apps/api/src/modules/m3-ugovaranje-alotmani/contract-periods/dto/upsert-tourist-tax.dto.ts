import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { TouristTaxCollectedBy } from '@prisma/client';

// M3 spec §2.7 — dopuna v1.12, isključivo informativno (vidi ogradu u spec-u §2.7:
// nijedan M3/M10/M11 endpoint ne sme ovo koristiti kao osnovu za fakturisanje/prijavu).
// 1:1 po periodu — servis radi pravi Prisma `upsert`, ne "uvek kreiraj novi red".
export class UpsertTouristTaxDto {
  @IsBoolean()
  includedInPrice!: boolean;

  // samo kad includedInPrice = false
  @ValidateIf((o: UpsertTouristTaxDto) => o.includedInPrice === false)
  @IsEnum(TouristTaxCollectedBy)
  collectedBy?: TouristTaxCollectedBy;

  @IsInt()
  @IsOptional()
  amountPerNight?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  taxExemptMaxAge?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
