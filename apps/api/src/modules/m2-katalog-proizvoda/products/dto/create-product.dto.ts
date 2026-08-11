import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ProductType } from '@prisma/client';

// M2 spec §7 — POST /products: "ručno kreiranje CONTRACTED proizvoda". sourceType se
// namerno ne prima kao ulaz — endpoint uvek kreira CONTRACTED (API-sourced proizvodi
// nastaju isključivo kroz M4 lenjo keširanje, §3.2, ne kroz ovaj endpoint).
export class CreateProductDto {
  @IsEnum(ProductType)
  type!: ProductType;

  @IsUUID()
  @IsOptional()
  sourceContractId?: string;

  @IsString()
  destinationCountry!: string;

  @IsString()
  destinationCity!: string;
}
