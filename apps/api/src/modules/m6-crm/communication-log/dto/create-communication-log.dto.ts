import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// M6 spec §4.1 — POST /communication-log. Bar jedno od clientAccountId/guestProfileId mora
// biti popunjeno (provereno u servisu). Kad je draftedByAi=true, sent_by se NIKAD ne postavlja
// pri kreiranju (bez obzira šta pozivalac pošalje) — mora proći kroz POST .../:id/mark-sent
// (isključivo ljudski nalog preko CurrentUser), CreateCommunicationLogDto.sentBy je namenjen
// isključivo ručnom evidentiranju već poslate/primljene poruke (draftedByAi=false).
export class CreateCommunicationLogDto {
  @IsOptional()
  @IsUUID()
  clientAccountId?: string;

  @IsOptional()
  @IsUUID()
  guestProfileId?: string;

  @IsIn(['EMAIL', 'PHONE', 'SMS', 'IN_PERSON'])
  channel!: 'EMAIL' | 'PHONE' | 'SMS' | 'IN_PERSON';

  @IsIn(['INBOUND', 'OUTBOUND'])
  direction!: 'INBOUND' | 'OUTBOUND';

  // §4.1 dopuna (1.9.2026) — podrazumevano MARKETING (postojeći marketing_consent gejt),
  // TRANSAKCIONO zaobilazi taj gejt (vidi napomenu u schema.prisma/spec).
  @IsOptional()
  @IsIn(['MARKETING', 'TRANSAKCIONO'])
  category?: 'MARKETING' | 'TRANSAKCIONO';

  @IsString()
  summary!: string;

  @IsOptional()
  @IsBoolean()
  draftedByAi?: boolean;

  @IsOptional()
  @IsUUID()
  sentBy?: string;
}
