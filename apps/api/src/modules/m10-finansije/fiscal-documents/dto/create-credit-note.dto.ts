import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// M10 spec §5.1a — KNJIZNO_ODOBRENJE nacrt, iz M7 CommissionRebate. Sad kad M7 postoji
// (avgust 2026), M7 FiscalDocumentStubService popunjava buyerNameSnapshot stvarnim nazivom
// firme (M6 ClientAccount.company_name preko Subagent.client_account_id) pre poziva ovog
// endpointa — polje ostaje opciono radi unazadne kompatibilnosti sa ručnim pozivom
// (npr. iz Swagger UI-a) kad naziv firme namerno nije poznat.
export class CreateCreditNoteDto {
  @IsString()
  relatedSubagentId!: string;

  @IsString()
  creditedRebateId!: string;

  @IsInt()
  @Min(1)
  amount!: number; // najmanja jedinica valute

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  buyerNameSnapshot?: string;
}
