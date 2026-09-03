import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ProductType } from '@prisma/client';
import { OccupancyInputDto } from '../../quotes/dto/create-quote.dto';

// M5 spec §6.7b (3.9.2026, vlasnikova odluka) — usluga koje nema ni u ugovoru ni kod
// provajdera, uneta rukom u samoj rezervaciji.
//
// Sva četiri polja koja je vlasnik nabrojao su OBAVEZNA: dobavljač, nabavna cena, marža i
// izlazna cena. Dobavljač nije administrativni detalj — bez njega ne rade ni vaučer po
// dobavljaču (§6) ni najava po dobavljaču (§6.7).
//
// Cena se ovde PRIMA od klijenta, za razliku od svake druge stavke — i to je namerno: ručna
// usluga po definiciji nema cenovnik iz kog bi se izvela. Zato se i traži i nabavna i izlazna
// cena, pa je marža proverljiva razlika, ne tvrdnja.
export class AddManualItemDto {
  @IsEnum(ProductType)
  productType!: ProductType;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  supplierId!: string;

  @IsString()
  destinationCountry!: string;

  @IsString()
  destinationCity!: string;

  /** Nabavna cena u najmanjoj jedinici valute (ista konvencija kao svuda u M5/M3). */
  @IsInt()
  @Min(0)
  baseCost!: number;

  /** Izlazna cena — ono što gost plaća. Mora biti >= nabavne (proverava servis). */
  @IsInt()
  @Min(0)
  finalPrice!: number;

  @IsString()
  currency!: string;

  @IsDateString()
  stayFrom!: string;

  @IsDateString()
  stayTo!: string;

  @ValidateNested()
  @Type(() => OccupancyInputDto)
  occupancy!: OccupancyInputDto;

  /**
   * §6.7b — jednokratna usluga ostaje `DRAFT` proizvod (nevidljiva pretrazi, javnom sajtu i
   * B2B portalu), a ovo je prevodi u `ACTIVE` da se sledeći put bira kao svaka druga.
   */
  @IsBoolean()
  @IsOptional()
  saveToCatalog?: boolean;
}
