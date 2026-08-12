import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

// M10 spec §5.2 — ručan unos prijema uplate (BANK_TRANSFER/CASH); CARD ide isključivo kroz
// /payments/card/* (webhook), nikad ovim putem. Gotovina namerno bez sistemskog limita (§5.2).
export class RecordPaymentDto {
  @IsString()
  bookingId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  currency!: string;

  @IsIn(['BANK_TRANSFER', 'CASH'])
  method!: 'BANK_TRANSFER' | 'CASH';

  @IsString()
  @IsOptional()
  reference?: string;
}
