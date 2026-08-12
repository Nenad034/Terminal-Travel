import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SupplierPaymentMethod } from '@prisma/client';

// M10 spec §8.5.2 `SupplierPaymentInstruction`.
export class CreateSupplierPaymentInstructionDto {
  @IsString()
  supplierObligationId!: string;

  @IsEnum(SupplierPaymentMethod)
  method!: SupplierPaymentMethod;

  @IsString()
  @IsOptional()
  bankIban?: string;

  @IsString()
  @IsOptional()
  bankSwift?: string;

  @IsString()
  @IsOptional()
  virtualCardReference?: string;
}
