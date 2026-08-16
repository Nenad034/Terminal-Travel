import { IsBoolean, IsOptional, IsString } from 'class-validator';

// M22 spec §8 — POST /threads/:id/messages, zahteva REPLY (M22 §7). Endpoint kreira isključivo
// STAFF poruke (ljudski, autentikovan poziv) — AI_DRAFT poruke nastaju samo kroz
// EmailAiAssistantService.processInboundMessage, nikad kroz ovaj DTO.
export class CreateMessageDto {
  @IsString()
  body!: string;

  // Ako je true, poruka se odmah smatra poslatom (sent_by popunjeno, adapter.sendMessage
  // pozvan). Ako je false/izostavljeno, ostaje nacrt (sent_by=null) — zaposleni ga naknadno
  // šalje preko POST /threads/:id/messages/:messageId/send.
  @IsOptional()
  @IsBoolean()
  send?: boolean;
}
