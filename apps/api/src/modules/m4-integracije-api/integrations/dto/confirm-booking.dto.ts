import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

// M4 spec §4 — "idempotency_key (generisan u M5 po pokušaju rezervacije)"
export class ConfirmBookingDto {
  @IsString()
  externalId!: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @IsInt()
  @Min(1)
  adults!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  children?: number;

  @IsString()
  guestName!: string;

  @IsString()
  idempotencyKey!: string;
}
