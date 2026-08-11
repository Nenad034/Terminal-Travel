import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ContractStatus, TipNastupanja } from '@prisma/client';

export class UpdateContractDto {
  @IsString() @IsOptional() cancellationTermsSummary?: string;
  @IsString() @IsOptional() documentUrl?: string;
  @IsEnum(ContractStatus) @IsOptional() status?: ContractStatus;
  @IsEnum(TipNastupanja) @IsOptional() defaultTipNastupanja?: TipNastupanja;
}
