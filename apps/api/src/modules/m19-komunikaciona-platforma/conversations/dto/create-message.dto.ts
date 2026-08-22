import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

// M19 spec §8 — POST /chat/conversations/:id/messages (REST fallback/istorija; WS
// `message.send` je primaran kanal za novo slanje, isti oblik tela).
export class CreateMessageDto {
  // Opciono od v1.6 (§2.5) — poruka može biti čist prilog bez teksta. Servis (ne DTO) odbija
  // poruku bez i teksta i priloga, jer DTO ne zna da li je fajl priložen (to je zaseban
  // `Express.Multer.File`, van ovog objekta).
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  // §2.3/§9.5 — klijent javlja da tekst potiče iz AI nacrta (§9.5 draft-reply), i onda kad ga je
  // zaposleni izmenio pre slanja. Namerno je ovo JEDINO što klijent šalje: koji agent je napisao
  // nacrt servis razrešava sam (SUPPLIER_DRAFT_AGENT), da klijent ne može pripisati poruku
  // proizvoljnom agentskom nalogu. `@Transform` prihvata i string "true"/"false" (multipart/
  // form-data polje uz prilog fajla stiže kao string, ne pravi boolean — JSON telo i dalje radi
  // nepromenjeno jer poredi i sa pravim `true`).
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  draftedByAi?: boolean;
}
