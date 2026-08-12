import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// M10 spec §8.1 — ručno kreiranje (van automatskog okidača §8.0), npr. troškovi bez BookingItem-a.
export class CreateSupplierObligationDto {
  @IsString()
  supplierId!: string;

  @IsString()
  @IsOptional()
  bookingItemId?: string;

  @IsInt()
  @Min(1)
  amountOriginal!: number;

  @IsString()
  currencyOriginal!: string;

  @IsString()
  dueDate!: string; // ISO datum
}
