import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { CommissionModel, ContractCurrency, TipNastupanja } from '@prisma/client';

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

  // M3 spec §2.2b — dopuna v1.12
  @IsEnum(CommissionModel)
  @IsOptional()
  commissionModel?: CommissionModel;

  // samo za commissionModel = COMMISSIONABLE (M3 spec §2.2b)
  @ValidateIf((o: CreateContractDto) => o.commissionModel === 'COMMISSIONABLE')
  @IsNumber()
  commissionPercentage?: number;
}
