import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ContractCurrency, TipNastupanja } from '@prisma/client';

// M3 spec §2.2
export class CreateContractDto {
  @IsUUID()
  supplierId!: string;

  @IsString()
  contractNumber!: string;

  @IsEnum(ContractCurrency)
  currency!: ContractCurrency;

  @IsDateString()
  validFrom!: string;

  @IsDateString()
  validTo!: string;

  @IsString()
  cancellationTermsSummary!: string;

  @IsString()
  documentUrl!: string;

  @IsEnum(TipNastupanja)
  @IsOptional()
  defaultTipNastupanja?: TipNastupanja;
}
