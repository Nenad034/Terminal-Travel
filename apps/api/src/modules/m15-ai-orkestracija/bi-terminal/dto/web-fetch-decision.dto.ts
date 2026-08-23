import { IsString, MinLength } from 'class-validator';

// M15 spec §6.9.7 — telo koje TerminalPanel.tsx šalje kad Vlasnik klikne "Odobri"/"Odbij" na
// predlog `propose_web_fetch`. Isti podaci koje je agent predložio se šalju nazad servisu (ne
// čuvaju se privremeno na serveru između predloga i klika) — jednostavnije od nove tabele za
// "predlog na čekanju", i dovoljno jer je vreme između predloga i klika kratko (isti ekran).
export class WebFetchDecisionDto {
  @IsString()
  @MinLength(1)
  url!: string;

  @IsString()
  reason!: string;

  @IsString()
  originalQuestion!: string;
}
