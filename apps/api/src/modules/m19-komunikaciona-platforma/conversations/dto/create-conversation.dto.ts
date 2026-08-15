import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// M19 spec §2.1/§8/§9.3/§9.7 — POST /chat/conversations. `participantUserIds` je obavezan za
// DIRECT (tačno jedan drugi STAFF, pozivalac se dodaje automatski) i GROUP (jedan ili više);
// za EXTERNAL_SUPPLIER se ignoriše (pozivalac postaje jedini STAFF učesnik preko granta pristupa
// koji se dešava u istom pozivu — vidi ConversationsService.create).
export class CreateConversationDto {
  @IsIn(['DIRECT', 'GROUP', 'EXTERNAL_SUPPLIER'])
  type!: 'DIRECT' | 'GROUP' | 'EXTERNAL_SUPPLIER';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  participantUserIds?: string[];

  // Samo za EXTERNAL_SUPPLIER (M19 spec §9.3) — plain UUID, weak ref ka M3 Supplier.
  @IsOptional()
  @IsUUID()
  supplierId?: string;
}
