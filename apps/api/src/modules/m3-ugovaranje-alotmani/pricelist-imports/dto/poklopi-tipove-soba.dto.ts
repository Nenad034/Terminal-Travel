import { ArrayMinSize, IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** M3 §2.11m — jedno poklapanje: tekst iz dobavljačevog dokumenta → šifra sobe iz kataloga. */
export class PoklapanjeTipaSobeDto {
  /** Doslovan `extracted_room_type` iz reda uvoza — poklapa se po tačnom tekstu. */
  @IsString()
  tekst!: string;

  /** `M2 Product.attributes.room_types[].code` (M2 §2.3a). */
  @IsString()
  code!: string;
}

/**
 * Odluka se čuva na redovima uvoza, ne šalje uz `primeni` — ključ razlike (§2.11l) sadrži tip
 * sobe, pa bi mapiranje poslato tek pri primeni promenilo ključeve u odnosu na one koje je čovek
 * video u spisku razlika.
 */
export class PoklopiTipoveSobaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PoklapanjeTipaSobeDto)
  mapiranja!: PoklapanjeTipaSobeDto[];
}
