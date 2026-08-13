import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

// M7 spec §11 — POST /subagents (agencija, Tier 1 kandidat) i POST /subagents/:id/children
// (roditeljski subagent, sub-subagent). parentSubagentId se popunjava iz rute za children,
// ne iz tela zahteva — vidi SubagentsController.
export class CreateSubagentDto {
  @IsUUID()
  clientAccountId!: string;

  // §3 — sub-subagentu proviziju sme da postavi samo roditelj, i tek uz ogradu (ne sme
  // preći roditeljevu trenutnu efektivnu proviziju) — opciono na kreiranju, može i kasnije
  // preko PATCH .../commission.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionPercentage?: number;
}
