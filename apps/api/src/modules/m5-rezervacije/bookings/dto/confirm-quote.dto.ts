import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { BuyerType, TipNastupanja } from '@prisma/client';

export class GuestInputDto {
  @IsInt()
  itemIndex!: number;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;
}

// M5 spec §4/§4.0a — POST /quotes/:id/confirm. tipNastupanja je opcioni RUČNI izbor,
// koristi se samo za INTERNAL_PANEL/PHONE (§4.0a korak 4) — za samouslužne kanale
// se uvek izvodi automatski i eksplicitan izbor ovde se ignoriše.
export class ConfirmQuoteDto {
  @IsEnum(TipNastupanja)
  @IsOptional()
  tipNastupanja?: TipNastupanja;

  // M5 spec §4.1 dopuna (v1.17) — minimalni podaci o kupcu, potrebni M10 fiskalizaciji
  // (SEF vs ESIR izbor po buyerType). Ne čekaju M6 — vidi napomenu na Booking modelu.
  @IsString()
  buyerName!: string;

  @IsEnum(BuyerType)
  buyerType!: BuyerType;

  @ValidateIf((o) => o.buyerType === BuyerType.PRAVNO_LICE)
  @IsString()
  buyerTaxId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestInputDto)
  @IsOptional()
  guests?: GuestInputDto[];
}
