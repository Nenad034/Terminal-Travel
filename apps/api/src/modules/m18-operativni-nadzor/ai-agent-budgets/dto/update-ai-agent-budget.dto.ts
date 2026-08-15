import { IsNumber, IsOptional, IsPositive } from 'class-validator';

// M18 spec §9 — PATCH /ai-agent-budgets/:id.
export class UpdateAiAgentBudgetDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  budgetLimitEur?: number;
}
