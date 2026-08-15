import { IsEnum, IsNumber, IsPositive, IsUUID } from 'class-validator';
import { QuotaPeriod } from '@prisma/client';

// M18 spec §6.5/§9 — POST /ai-agent-budgets. Za razliku od AIProviderQuota, budget_limit_eur
// je ovde obavezan — red se kreira TEK kad Vlasnik/Direktor stvarno odluči da postavi budžet
// tom agentu (spec §6.5 tabela ga ne označava kao nullable, za razliku od AIProviderQuota).
export class CreateAiAgentBudgetDto {
  @IsUUID()
  agentId!: string;

  @IsEnum(QuotaPeriod)
  period!: QuotaPeriod;

  @IsNumber()
  @IsPositive()
  budgetLimitEur!: number;
}
