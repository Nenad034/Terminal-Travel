import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * M3 spec §4.2.10 (v1.39) — primena potvrđenih razlika iz uvoza, za JEDAN ugovor.
 *
 * Namerno ne prima cene: predlog se gradi iz `PricelistImportRow` zapisa na serveru, a klijent
 * šalje samo koje je razlike čovek potvrdio. Da klijent šalje i cene, potvrđeno i primenjeno bi
 * mogli da se raziđu, a potvrda tada ne znači ništa (§2.11l, pravilo 3).
 */
export class PrimeniUvozDto {
  /** Od kog datuma nova cena važi. Rezervacije nastale ranije ostaju na staroj (§2.11l). */
  @IsDateString()
  effectiveFrom!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  prihvaceniKljucevi!: string[];

  /**
   * §2.11m — svesna potvrda da se cenovnik upisuje sa tipom sobe koji katalog ne poznaje.
   *
   * Dobavljač SME imati tip koji katalog još nema, pa tvrdo odbijanje ne bi bilo tačno. Ali
   * takav red u prodaji neće biti prepoznat kao soba iz kataloga, pa provera kapaciteta nad njim
   * ne može da radi (zamka 7.14) — zato mora biti izbor, ne propuštanje. Bez ovoga primena se
   * odbija i poruka nabraja tipove koji nisu poklopljeni.
   */
  @IsOptional()
  @IsBoolean()
  dozvoliNepoklopljeneTipoveSoba?: boolean;
}
