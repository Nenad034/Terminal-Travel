import { PriceBasis } from '@prisma/client';
import { Type } from 'class-transformer';
import { PredlozenaUzrasnaCenaDto } from './predlog-cenovnika.dto';
import {
  ArrayMaxSize,
  ValidateNested,
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
} from 'class-validator';

// M3 spec §2.11 — upis jedne ćelije mreže: sezona × tip sobe × cenovni red.
export class WriteCellDto {
  @IsString()
  @MinLength(1)
  seasonId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  roomType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  boardType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  occupancy!: string;

  // Vrednosti se IZVODE iz Prisma enuma, nikad ne prepisuju rukom (zamka 7.8):
  // razlika između šeme i baze prolazi `tsc` i pada tek pri upisu, kao 500 nad pravim podacima.
  @IsEnum(PriceBasis)
  priceBasis!: PriceBasis;

  /** Najmanja jedinica valute ugovora (§2). Ekran prima „89,50", pretvaranje radi panel. */
  @IsInt()
  @Min(1)
  price!: number;

  /**
   * §2.11d — dani u nedelji za koje ova cena važi (1 = ponedeljak … 7 = nedelja).
   * Izostavljeno ili prazno = **svi dani**. Vikend cena je drugi red sa drugim danima, ne
   * nova sezona (vlasnikova odluka 9.9.2026).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  validWeekdays?: number[];

  // §2.11e — „za rezervacije od…do" na samoj stavci; prazno = bez ograničenja.
  @IsOptional()
  @IsDateString()
  bookingFrom?: string;

  @IsOptional()
  @IsDateString()
  bookingTo?: string;

  /**
   * §4.2.10 (v1.39) — krevetac i uzrasna cena se od sada upisuju i ovim putem.
   *
   * Bez toga bi prelazak uvoza (§4.2) na tok verzija tiho obrisao svaku uvezenu dečju cenu:
   * snimak ih je već poredio, ali ih nijedan upisni put osim red-po-red potvrde nije pisao.
   *
   * `undefined` znači „ne diraj" — ćelija upisana sa ekrana mreže nema ta polja i ne sme da
   * obriše ono što je uvoz doneo. Prazan niz je izričito brisanje.
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
