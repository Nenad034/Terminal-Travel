import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * M3 spec §2.11o — kalendar cena i raspoloživosti.
 *
 * Sastav gostiju je obavezan deo upita, ne ukras: cena bez sastava ne postoji čim cenovnik ima
 * cenu po osobi ili doplatu po uzrastu. „2 odrasle + 1 dete od 8 godina" je vlasnikov primer.
 */
export class PricelistCalendarQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  roomType!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  /** Broj odraslih u sobi. Bar jedan — soba bez odraslog se ne prodaje. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  adults!: number;

  /**
   * Godine svakog deteta, pojedinačno. Ne „broj dece": doplata se razlikuje po uzrastu (§2.4a),
   * pa dete od 3 i dete od 14 godina nisu ista stavka. Prazno = nema dece.
   */
  @IsOptional()
  @Type(() => Number)
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(17, { each: true })
  childrenAges?: number[];
}
