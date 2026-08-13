import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// M14 spec §2.2/§4/§6 — POST /tickets/:id/messages. Kad je senderType=AI_DRAFT, sent_by NIKAD
// nije popunjeno pri kreiranju (isti obrazac kao M6 CommunicationLog.draftedByAi) — jedini put
// je POST .../messages/:messageId/send. Kad je senderType=STAFF, servis popunjava sent_by
// automatski sa ID-jem pozivaoca (poziv je već ljudski nalog preko JwtAuthGuard-a, nema
// potrebe za odvojenim mark-sent korakom). REQUESTER poruke (odgovor gosta/subagenta) nemaju
// koncept sent_by (nije primenjivo, ostaje null).
export class CreateTicketMessageDto {
  @IsIn(['REQUESTER', 'STAFF', 'AI_DRAFT'])
  senderType!: 'REQUESTER' | 'STAFF' | 'AI_DRAFT';

  @IsOptional()
  @IsUUID()
  senderId?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternalNote?: boolean;
}
