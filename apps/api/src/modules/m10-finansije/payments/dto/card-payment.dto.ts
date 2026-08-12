import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, ValidateNested } from 'class-validator';
import { GuestInputDto } from '../../../m5-rezervacije/bookings/dto/confirm-quote.dto';
import { BuyerType } from '@prisma/client';

export class InitiateCardPaymentDto {
  @IsString()
  quoteId!: string;

  @IsString()
  idempotencyKey!: string;
}

// M10 spec §7.2 — pravi provajder šalje sopstveni webhook oblik (izbor provajdera otvoren, §12);
// dok se ne izabere, mock webhook nosi iste podatke koje je gost uneo pri "Plati i rezerviši"
// (potrebni M5 confirmQuote toku, korak 3), kako bi ceo lanac initiate → webhook → M5 potvrda
// mogao biti izgrađen i testiran bez čekanja na stvaran provajder.
export class CardPaymentWebhookDto {
  @IsString()
  gatewayTransactionId!: string;

  @IsString()
  buyerName!: string;

  @IsEnum(BuyerType)
  buyerType!: BuyerType;

  @IsString()
  @IsOptional()
  buyerTaxId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestInputDto)
  @IsOptional()
  guests?: GuestInputDto[];
}
