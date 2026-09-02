import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CheckDetailDto } from './check-detail.dto';

// M10 spec §5.2 — ručan unos prijema uplate; CARD (webhook) ide isključivo kroz /payments/card/*,
// nikad ovim putem. Gotovina namerno bez sistemskog limita (§5.2). Dopuna (2.9.2026, na zahtev
// vlasnika) — CARD_MANUAL/CHECK/ADMINISTRATIVE_BAN dodati kao novi ručni načini; BANK_TRANSFER/
// CARD_MANUAL zahtevaju `bankId` ("odabrati banku iz baze banaka"/"za kartice takođe od koje
// banke"), CHECK zahteva `checkDetails` (specifikacija čekova, čiji zbir mora pokriti `amount` —
// proverava PaymentsService, ne DTO, jer zahteva zbir preko niza).
export class RecordPaymentDto {
  @IsString()
  bookingId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  currency!: string;

  @IsIn(['BANK_TRANSFER', 'CASH', 'CARD_MANUAL', 'CHECK', 'ADMINISTRATIVE_BAN'])
  method!: 'BANK_TRANSFER' | 'CASH' | 'CARD_MANUAL' | 'CHECK' | 'ADMINISTRATIVE_BAN';

  @IsString()
  @IsOptional()
  reference?: string;

  @ValidateIf((dto: RecordPaymentDto) => dto.method === 'BANK_TRANSFER' || dto.method === 'CARD_MANUAL')
  @IsString()
  bankId?: string;

  @ValidateIf((dto: RecordPaymentDto) => dto.method === 'CHECK')
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckDetailDto)
  checkDetails?: CheckDetailDto[];
}
