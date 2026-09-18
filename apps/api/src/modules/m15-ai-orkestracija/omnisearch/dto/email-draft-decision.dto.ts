import { IsEmail, IsString, MinLength } from 'class-validator';

// M15 spec §6.5.4.8 — telo koje panel šalje kad korisnik klikne "Odobri"/"Odbij" na predlog
// `compose_email`. Isti obrazac kao WebFetchDecisionDto (BiTerminalAgent §6.9.7) — predlog se ne
// čuva privremeno na serveru, klijent šalje nazad tačno ono što je agent predložio.
export class EmailDraftDecisionDto {
  @IsEmail()
  to!: string;

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  body!: string;

  @IsString()
  mailboxId!: string;

  @IsString()
  mailboxAddress!: string;
}
