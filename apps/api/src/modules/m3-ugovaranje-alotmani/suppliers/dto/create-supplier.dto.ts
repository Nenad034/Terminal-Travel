import { IsEmail, IsEnum, IsString } from 'class-validator';
import { SupplierType } from '@prisma/client';

// M3 spec §2.1
export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsEnum(SupplierType)
  type!: SupplierType;

  @IsString()
  taxId!: string;

  @IsString()
  registrationNumber!: string;

  @IsString()
  country!: string;

  @IsString()
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsString()
  contactPhone!: string;
}
