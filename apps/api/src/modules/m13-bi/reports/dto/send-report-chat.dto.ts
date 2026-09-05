import { IsString, MinLength } from 'class-validator';

// M13 spec §7 (v1.5 dopuna) — isti oblik kao M15 §6.9.3 dopuna
// (`m15-ai-orkestracija/bi-terminal/dto/send-report-chat.dto.ts`), ovde nezavisna kopija jer
// M13 export tok ima sopstvenu dozvolu (programska provera po `reportKind`, ne statična
// @RequirePermission kao M15 bi-terminal).
export class SendReportChatDto {
  @IsString()
  @MinLength(1)
  conversationId!: string;
}
