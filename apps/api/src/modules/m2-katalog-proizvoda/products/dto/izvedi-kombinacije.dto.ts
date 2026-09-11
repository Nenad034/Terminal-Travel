import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

// M2 spec §2.3g — panel iscrtava matricu DOK se soba uređuje, dakle pre nego što je ijedno polje
// snimljeno. Zato ulaz nisu id proizvoda i šifra sobe nego sami kreveti iz otvorenog obrasca.
//
// Zašto endpoint, a ne ista funkcija prepisana u panel: izvođenje matrice je jedini izvor istine
// za dve odvojene stvari — šta ekran nudi i šta M5 pri prodaji prihvata (korak 3). Dve kopije
// istog algoritma se tiho raziđu, pa bi ekran nudio red koji prodaja odbija. Podrazumevani
// `age_policy` niz JESTE prepisan u panel (v1.14), ali konstanta se vidi golim okom; algoritam ne.

class BedsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  base_beds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extra_beds_max?: number | null;
}

class BedCombinationOverrideDto {
  @IsString()
  key!: string;

  @IsOptional()
  @IsBoolean()
  allowed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  shared_bed_children?: number;

  @IsOptional()
  @IsString()
  note?: string | null;
}

export class IzvediKombinacijeDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => BedsDto)
  beds?: BedsDto;

  @IsOptional()
  @IsInt()
  @Min(1)
  min_occupancy?: number | null;

  /** Već uneta odstupanja — šalju se da bi odgovor odmah rekao i koje je od njih ostalo van matrice. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BedCombinationOverrideDto)
  bed_combinations?: BedCombinationOverrideDto[];
}
