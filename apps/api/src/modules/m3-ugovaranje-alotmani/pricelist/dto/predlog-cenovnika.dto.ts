import { AgeCategory, AgePricingMode, PriceBasis } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ValidateIf,
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
 * §4.2.10 — uzrasna cena uz predloženi red. Oblik prati `RateLineAgePricing` (§2.4a); vrednosti
 * se IZVODE iz Prisma enuma, nikad ne prepisuju rukom (zamka 7.8).
 */
export class PredlozenaUzrasnaCenaDto {
  @IsEnum(AgeCategory)
  ageCategory!: AgeCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  occupantIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minAdultsPresent?: number;

  @IsEnum(AgePricingMode)
  pricingMode!: AgePricingMode;

  /** Samo za `PERCENTAGE_OF_BASE_PRICE`. */
  @ValidateIf((o: PredlozenaUzrasnaCenaDto) => o.pricingMode === 'PERCENTAGE_OF_BASE_PRICE')
  @IsInt()
  @Min(0)
  @Max(100)
  percentage?: number;

  /** Samo za `FLAT_PRICE_PER_NIGHT`, u najmanjoj jedinici valute. */
  @ValidateIf((o: PredlozenaUzrasnaCenaDto) => o.pricingMode === 'FLAT_PRICE_PER_NIGHT')
  @IsInt()
  @Min(0)
  flatPrice?: number;
}

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

  /**
   * §4.2.10 (v1.39) — doplata za krevetac i uzrasna cena stižu uz predlog.
   *
   * Do ove dopune ih predlog nije nosio, a `writeCell` ih nije upisivao — pa bi prelazak uvoza
   * (§4.2) na ovaj put TIHO obrisao svaku uvezenu dečju cenu. Snimak ih je pri tom već poredio
   * (`detalji`), dakle bile su vidljive u razlikama a nezapisive kroz njih.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  cribFeePerNight?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PredlozenaUzrasnaCenaDto)
  agePricing?: PredlozenaUzrasnaCenaDto[];
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
