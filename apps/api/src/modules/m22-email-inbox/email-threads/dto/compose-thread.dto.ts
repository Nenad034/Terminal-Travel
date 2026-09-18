import { ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

// M22 spec §3.1b/§8 — POST /threads/compose, zahteva REPLY (M22 §7) za `mailboxId`. Novi
// razgovor proizvoljnom primaocu (koji do sad nije pisao nama) — do sad je M22 umeo isključivo
// da odgovori unutar postojeće niti (CreateMessageDto).
export class ComposeThreadDto {
  @IsString()
  mailboxId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  toAddresses!: string[];

  @IsString()
  subject!: string;

  @IsString()
  body!: string;

  // Bez unapred poznatog primaoca u sistemu nema šta da poklopi §3.1 (tačno poklapanje adrese)
  // — podrazumevano 'OTHER', isto ponašanje kao svaki drugi neprepoznat korespondent.
  @IsOptional()
  @IsIn(['GUEST', 'SUBAGENT', 'SUPPLIER', 'OTHER'])
  correspondentType?: 'GUEST' | 'SUBAGENT' | 'SUPPLIER' | 'OTHER';

  // `false` (podrazumevano) — samo nacrt (`senderType:'AI_DRAFT'`, `sentBy:null`), isključivo
  // ovaj put koristi M15 §6.5.4.8 (`compose_email` alat, uvek send:false). `true` — ljudski,
  // ručan unos direktno u M22 ekranu, šalje odmah (§3.1b) — UI za ovaj put namerno nije napravljen
  // u ovom prolazu (M22 spec poglavlje 10), DTO/servis ga već podržava za kasnije.
  @IsOptional()
  @IsBoolean()
  send?: boolean;
}
