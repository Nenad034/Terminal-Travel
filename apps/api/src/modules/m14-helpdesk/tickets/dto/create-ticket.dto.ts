import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// M14 spec §2.1/§6 — POST /tickets. requesterClientAccountId je ignorisano/prepisano u
// servisu za Gost/SUBAGENT_ADMIN pozivaoce (uvek sopstveni nalog — vidi
// TicketsService.resolveOwnRequesterAccountId), polje ostaje otvoreno za interni tim koji
// prijavljuje tiket u ime gosta koji je zvao telefonom (requesterType=STAFF_ON_BEHALF).
export class CreateTicketDto {
  @IsOptional()
  @IsUUID()
  requesterClientAccountId?: string;

  @IsIn(['GUEST', 'SUBAGENT', 'STAFF_ON_BEHALF'])
  requesterType!: 'GUEST' | 'SUBAGENT' | 'STAFF_ON_BEHALF';

  @IsOptional()
  @IsUUID()
  relatedBookingId?: string;

  @IsString()
  subject!: string;

  @IsIn(['REZERVACIJA', 'PLACANJE', 'TEHNICKI_PROBLEM', 'REKLAMACIJA', 'DRUGO'])
  category!: 'REZERVACIJA' | 'PLACANJE' | 'TEHNICKI_PROBLEM' | 'REKLAMACIJA' | 'DRUGO';

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @IsIn(['SITE_FORM', 'B2B_PORTAL', 'EMAIL', 'PHONE', 'HELP_CENTER'])
  channel!: 'SITE_FORM' | 'B2B_PORTAL' | 'EMAIL' | 'PHONE' | 'HELP_CENTER';

  @IsOptional()
  @IsUUID()
  sourceEmailThreadId?: string;
}
