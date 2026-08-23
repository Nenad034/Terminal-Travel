import { IsString, MinLength } from 'class-validator';

// M15 spec §6.9.3 dopuna — "predloži pa čovek odobri": ovaj poziv je NEZAVISAN, ljudski
// pokrenut klik (dugme u TerminalPanel.tsx), nikad nešto što BiTerminalAgent sam pozove iz
// tool-use petlje.
export class SendReportChatDto {
  @IsString()
  @MinLength(1)
  conversationId!: string;
}
