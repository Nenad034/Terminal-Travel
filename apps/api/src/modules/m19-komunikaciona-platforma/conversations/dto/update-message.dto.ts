import { IsString, MinLength } from 'class-validator';

// M19 spec §2.3 — PATCH tela za izmenu poruke (samo pošiljalac, popunjava edited_at).
export class UpdateMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
