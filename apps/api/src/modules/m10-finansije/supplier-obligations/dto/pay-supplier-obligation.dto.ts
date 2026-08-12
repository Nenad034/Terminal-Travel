import { IsOptional, IsString } from 'class-validator';

export class PaySupplierObligationDto {
  @IsString()
  @IsOptional()
  paidAt?: string; // ISO datum, podrazumevano "sad"
}
