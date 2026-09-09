import { ArrayNotEmpty, IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/** M3 spec §2.8a — kapacitet za jedan dan/raspon; `capacity = null` vraća dan na kapacitet perioda. */
export class SetCapacityOverrideDto {
  /**
   * §2.8a (v1.23) — jedan tip sobe. Ostaje radi postojećih poziva; nov put je
   * `contractPeriodIds` ispod. Servis traži da bar jedno od to dvoje bude zadato.
   */
  @IsUUID()
  @IsOptional()
  contractPeriodId?: string;

  /** §2.8a (v1.23) — IZABRANI tipovi soba, više odjednom (ekran M17 §4b.3a). */
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
  @Min(0)
  @IsOptional()
  capacity!: number | null;
}
