import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { CheckDetailDto } from './check-detail.dto';

// M10 spec §5.2 dopuna (2.9.2026, na zahtev vlasnika: "prilikom kucanja specifikacije čekova
// može doći do greške... treba omogućiti korigovanje" + "uplatu bilo koje vrste je moguće
// izmeniti samo pod uslovom da već nije kreiran račun i nije urađena fiskalizacija") — isti
// oblik kao `RecordPaymentDto` (bez `bookingId`, ne menja se), potpuna zamena editabilnih
// polja (ne parcijalni PATCH) — jednostavnije za proveriti i za audit trag (jasno "pre/posle").
export class UpdatePaymentDto {
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

  @ValidateIf((dto: UpdatePaymentDto) => dto.method === 'BANK_TRANSFER' || dto.method === 'CARD_MANUAL')
  @IsString()
  bankId?: string;

  @ValidateIf((dto: UpdatePaymentDto) => dto.method === 'CHECK')
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckDetailDto)
  checkDetails?: CheckDetailDto[];
}
