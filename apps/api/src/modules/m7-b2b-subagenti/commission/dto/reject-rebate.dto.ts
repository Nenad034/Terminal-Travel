import { IsString } from 'class-validator';

// M7 spec §11 — POST /subagents/:id/commission-rebates/:rebateId/reject ("odbijanje, sa razlogom").
export class RejectRebateDto {
  @IsString()
  reason!: string;
}
