import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

// M14 spec §6 — PATCH /tickets/:id, izmena statusa/prioriteta/dodele. `refundDecision`
// (spec §8 "otvoreno za dalje", zatvoreno avgust 2026 — vidi 14-SPECIFIKACIJA-M14-HELPDESK.md
// §3.2) je mehanizam kojim se formalno beleži odluka o povraćaju pri zatvaranju reklamacije:
// status=RESOLVED + refundDecision=true okida M14 ticket.resolved_with_refund (§3.2).
export class UpdateTicketDto {
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @IsOptional()
  @IsBoolean()
  refundDecision?: boolean;
}
