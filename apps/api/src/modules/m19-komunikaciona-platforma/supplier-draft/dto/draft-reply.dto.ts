import { IsOptional, IsString } from 'class-validator';

// M19 spec §9.5/§9.7 — POST /chat/supplier-conversations/:id/draft-reply. `instruction` je
// opciono kratko uputstvo zaposlenog ("odgovori da cena važi do petka") koje se dodaje sistemskom
// promptu — bez njega AI samo sažima poslednju prepisku i predlaže neutralan odgovor.
export class DraftReplyDto {
  @IsOptional()
  @IsString()
  instruction?: string;
}
