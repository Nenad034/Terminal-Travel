import { IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * M3 spec §4.8 — izmena cenovnika rečima.
 *
 * Nosi tačno dve stvari: rečenicu i datum od kog nova cena važi. Sve ostalo se izvodi iz
 * zatečenog cenovnika — rečenica ne sme da traži da čovek unapred zna oznake sezona ni id-ove.
 */
export class PricelistInstructionDto {
  /**
   * Rečenica kakva bi se rekla kolegi. Čuva se uz nastalu verziju (`instruction_text`, §4.8.2):
   * bez nje se ne može utvrditi da li je model pogrešno razumeo ili je tako i rečeno.
   */
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  instructionText!: string;

  @IsDateString()
  effectiveFrom!: string;
}
