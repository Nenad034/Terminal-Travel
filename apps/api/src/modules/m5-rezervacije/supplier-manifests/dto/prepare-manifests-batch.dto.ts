import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { SupplierManifestLanguage } from '@prisma/client';

// M5 spec §8.4 dopuna (v1.16) — POST /supplier-manifests/prepare-batch. Tačno jedan od
// bookingIds / (createdFrom+createdTo) mora biti prosleđen — proverava se u servisu.
export class PrepareManifestsBatchDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @IsOptional()
  bookingIds?: string[];

  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @IsDateString()
  @IsOptional()
  createdTo?: string;

  @IsEnum(SupplierManifestLanguage)
  @IsOptional()
  language?: SupplierManifestLanguage;
}
