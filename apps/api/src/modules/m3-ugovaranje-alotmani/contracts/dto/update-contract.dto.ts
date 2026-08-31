import { IsEnum, IsNumber, IsOptional, IsString, ValidateIf } from 'class-validator';
import { CommissionModel, ContractStatus, TipNastupanja } from '@prisma/client';

export class UpdateContractDto {
  @IsString() @IsOptional() cancellationTermsSummary?: string;
  @IsString() @IsOptional() documentUrl?: string;
  @IsEnum(ContractStatus) @IsOptional() status?: ContractStatus;
  @IsEnum(TipNastupanja) @IsOptional() defaultTipNastupanja?: TipNastupanja;

  // M3 spec §2.2b — dopuna v1.12
  @IsEnum(CommissionModel) @IsOptional() commissionModel?: CommissionModel;

  // samo za commissionModel = COMMISSIONABLE (M3 spec §2.2b)
  @ValidateIf((o: UpdateContractDto) => o.commissionModel === 'COMMISSIONABLE')
  @IsNumber()
  commissionPercentage?: number;
}
