import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { SupplierManifestLanguage } from '@prisma/client';

// M5 spec §8.1/§8.3/§8.4/§11 — POST /supplier-manifests: agregacija potvrđenih CONTRACTED
// stavki po dobavljaču + periodu.
export class GenerateManifestDto {
  @IsString()
  supplierId!: string;

  @IsString()
  @IsOptional()
  contractPeriodId?: string;

  @IsDateString()
  periodFrom!: string;

  @IsDateString()
  periodTo!: string;

  @IsEnum(SupplierManifestLanguage)
  @IsOptional()
  language?: SupplierManifestLanguage;
}
