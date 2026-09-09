import { PriceBasis } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Jedan predloženi cenovni red. Sezona se navodi **oznakom** (`seasonCode`), ne id-em: predlog
 * dolazi iz pročitanog dokumenta, gde piše „sezona 1", a ne unutrašnji identifikator.
 */
export class PredlozenRedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  roomType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  seasonCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  boardType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  occupancy!: string;

  // Vrednosti se IZVODE iz Prisma enuma, nikad ne prepisuju rukom (zamka 7.8).
  @IsEnum(PriceBasis)
  priceBasis!: PriceBasis;

  /** Najmanja jedinica valute ugovora (§2). */
  @IsInt()
  @Min(1)
  price!: number;

  /** §2.11d — prazno = svi dani. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  validWeekdays?: number[];

  @IsOptional()
  @IsDateString()
  bookingFrom?: string;

  @IsOptional()
  @IsDateString()
  bookingTo?: string;
}

/**
 * M3 spec §2.11l — predlog celog cenovnika (§4.2 uvoz dokumenta, §4.8 izmena rečima).
 *
 * Isti DTO služi i za prikaz razlika (`prihvaceniKljucevi` se ne šalje) i za primenu (šalje se
 * samo ono što je čovek potvrdio). Namerno je isti oblik: predlog nad kojim se odlučuje mora
 * biti doslovno onaj koji se primenjuje, inače potvrda ne znači ništa.
 */
export class PredlogCenovnikaDto {
  @IsDateString()
  effectiveFrom!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PredlozenRedDto)
  redovi!: PredlozenRedDto[];

  /**
   * Ključevi razlika koje je čovek potvrdio. Prazno pri prikazu razlika; obavezno pri primeni —
   * primena bez ijedne potvrđene razlike se odbija, da „primeni sve" nikad ne bude podrazumevano.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prihvaceniKljucevi?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** §4.8 — rečenica kojom je izmena tražena; čuva se uz nastalu verziju. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructionText?: string;

  @IsOptional()
  @IsString()
  sourceImportId?: string;
}
