import { IsDateString, IsNumber, IsString, Min } from 'class-validator';

// M10 spec §3.1 `ExchangeRateSnapshot` — ručan unos dok automatski NBS izvor nije povezan (§12).
export class CreateExchangeRateDto {
  @IsString()
  currency!: string;

  @IsDateString()
  rateDate!: string;

  @IsNumber()
  @Min(0)
  nbsMiddleRate!: number;
}
