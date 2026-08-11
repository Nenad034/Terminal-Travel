import { IsEnum, IsOptional } from 'class-validator';
import { SupplierManifestLanguage } from '@prisma/client';

// M5 spec §8.4 dopuna (v1.15) — POST /bookings/:id/prepare-supplier-manifests
export class PrepareSupplierManifestsDto {
  @IsEnum(SupplierManifestLanguage)
  @IsOptional()
  language?: SupplierManifestLanguage;
}
