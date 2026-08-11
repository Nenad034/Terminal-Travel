import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { SupplierStatus } from '@prisma/client';

export class UpdateSupplierDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() contactName?: string;
  @IsEmail() @IsOptional() contactEmail?: string;
  @IsString() @IsOptional() contactPhone?: string;
  @IsString() @IsOptional() bankAccount?: string;
  @IsEnum(SupplierStatus) @IsOptional() status?: SupplierStatus;
}
