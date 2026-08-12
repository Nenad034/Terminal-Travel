import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// M10 spec §8.6.4 — potvrđuje predloženo (ili ručno zadato) mapiranje; opciona korekcija iznosa
// ako se razlikuje od automatski kreirane vrednosti (§8.0).
export class ConfirmSupplierInvoiceRowDto {
  @IsString()
  @IsOptional()
  matchedSupplierObligationId?: string; // ako je prosleđeno i različito od predloga -> MANUALLY_MATCHED

  @IsInt()
  @Min(1)
  @IsOptional()
  correctedAmount?: number;
}
