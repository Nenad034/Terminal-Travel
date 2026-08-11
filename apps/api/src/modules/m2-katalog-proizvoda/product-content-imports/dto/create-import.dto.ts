import { IsArray, IsEnum, IsIn, IsObject, IsOptional, IsUUID, IsUrl, ValidateIf } from 'class-validator';
import { ImportFieldType, ImportOrigin } from '@prisma/client';

class PrefilledFieldDto {
  @IsEnum(ImportFieldType)
  fieldType!: ImportFieldType;

  @IsObject()
  extractedValue!: Record<string, unknown>;

  @IsOptional()
  matchConfidence?: number;

  @IsUUID()
  @IsOptional()
  sourceArticleRevisionId?: string;
}

// M2 spec §3.3/§3.3a — POST /product-content-imports. MANUAL_URL nosi source_url (zaposleni
// pokreće uvoz); M23_RESEARCH nosi product_id + unapred popunjen fields[] (ekstrakcija već
// urađena u M23), bez source_url.
export class CreateImportDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsEnum(ImportOrigin)
  @IsOptional()
  origin?: ImportOrigin;

  @ValidateIf((o: CreateImportDto) => (o.origin ?? 'MANUAL_URL') === 'MANUAL_URL')
  @IsUrl({ require_tld: false })
  sourceUrl?: string;

  @ValidateIf((o: CreateImportDto) => o.origin === 'M23_RESEARCH')
  @IsArray()
  fields?: PrefilledFieldDto[];
}
