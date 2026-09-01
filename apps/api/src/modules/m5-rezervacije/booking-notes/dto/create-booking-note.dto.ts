import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// M5 spec §4.6 — `created_by` se NIKAD ne prima iz tela zahteva, uvek se uzima iz tokena.
export class CreateBookingNoteDto {
  @ApiProperty({ maxLength: 4000, description: 'Tekst beleške (M5 spec §4.6)' })
  @IsString()
  @MinLength(1, { message: 'Beleška ne može biti prazna.' })
  @MaxLength(4000, { message: 'Beleška može imati najviše 4000 znakova.' })
  body!: string;
}
