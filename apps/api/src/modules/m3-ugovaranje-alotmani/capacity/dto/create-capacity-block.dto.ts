import {
  ArrayNotEmpty,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * M3 spec §2.8b — `reason` i `holdUntil` su OBAVEZNI, namerno na nivou DTO-a a ne "po dogovoru":
 * blokada bez roka je najsigurniji način da kapacitet tiho propadne do kraja sezone.
 */
export class CreateCapacityBlockDto {
  /** §2.8a (v1.23) — jedan tip sobe; ostaje radi postojećih poziva. */
  @IsUUID()
  @IsOptional()
  contractPeriodId?: string;

  /**
   * §2.8a (v1.23) — IZABRANI tipovi soba (ekran M17 §4b.3a). `units` se NE deli među njima:
   * "blokiraj 2 jedinice" nad tri tipa soba znači dve jedinice u SVAKOM od njih, jer je to
   * jedini izračun koji ne zavisi od redosleda i koji čovek može da predvidi.
   */
  @IsUUID('4', { each: true })
  @ArrayNotEmpty()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return Array.isArray(value) ? value : [value];
  })
  contractPeriodIds?: string[];

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;

  @IsInt()
  @Min(1)
  units!: number;

  @IsString()
  @MinLength(3)
  reason!: string;

  @IsDateString()
  holdUntil!: string;
}
