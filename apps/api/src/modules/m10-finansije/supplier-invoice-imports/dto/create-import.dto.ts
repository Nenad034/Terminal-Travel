import { IsEnum, IsString } from 'class-validator';
import { SupplierInvoiceSourceFormat } from '@prisma/client';

// M10 spec §8.6.1 `SupplierInvoiceImport`.
export class CreateSupplierInvoiceImportDto {
  @IsString()
  supplierId!: string;

  @IsString()
  sourceFileUrl!: string;

  @IsEnum(SupplierInvoiceSourceFormat)
  sourceFormat!: SupplierInvoiceSourceFormat;
}
