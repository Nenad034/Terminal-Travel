import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

// M19 spec §8 — POST /chat/conversations/:id/messages (REST fallback/istorija; WS
// `message.send` je primaran kanal za novo slanje, isti oblik tela).
export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;

  // §2.3/§9.5 — klijent javlja da tekst potiče iz AI nacrta (§9.5 draft-reply), i onda kad ga je
  // zaposleni izmenio pre slanja. Namerno je ovo JEDINO što klijent šalje: koji agent je napisao
  // nacrt servis razrešava sam (SUPPLIER_DRAFT_AGENT), da klijent ne može pripisati poruku
  // proizvoljnom agentskom nalogu.
  @IsOptional()
  @IsBoolean()
  draftedByAi?: boolean;
}
