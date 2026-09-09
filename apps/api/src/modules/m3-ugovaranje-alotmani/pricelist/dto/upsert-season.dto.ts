import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// M3 spec §2.11b — sezona je kolona cenovnika i ima VIŠE datumskih opsega.
export class SeasonRangeDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}

export class UpsertSeasonDto {
  /** Kratka oznaka iz cenovnika: „1", „A", „Špic". Jedinstvena unutar ugovora. */
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  rank?: number;

  // Najmanje jedan opseg — sezona bez datuma nije kolona nego prazno mesto.
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SeasonRangeDto)
  ranges!: SeasonRangeDto[];
}
