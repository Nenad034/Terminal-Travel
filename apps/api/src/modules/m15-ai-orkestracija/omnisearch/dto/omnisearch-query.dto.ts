import { IsArray, IsIn, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const LANGUAGE_CODES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'] as const;

// Dopuna (25.8.2026, uživo — vlasnik je primetio da "da" posle pitanja o konkretnoj rezervaciji
// dobija potpuno nepovezan odgovor) — isti uzrok i isto rešenje kao BiTerminalQueryDto
// (bi-terminal-query.dto.ts, 23.8.2026): svaki `/omnisearch` poziv je bio izolovan razgovor bez
// pamćenja prethodnih tura. Panel (AiChatBox.tsx) je jedini koji pamti istoriju te sesije u
// pregledaču — nema novog trajnog mehanizma na serveru (i dalje važi audit log §10, po pozivu).
export class OmnisearchHistoryTurnDto {
  @IsString()
  question!: string;

  @IsString()
  answer!: string;
}

// M15 spec §6.5.4, §9 — POST /ai-orchestration/omnisearch. `channel` je prošireno (dopuna
// avgust 2026, M8 §3a implementacija) sa `B2C_SITE` — prvi prolaz (v1.9) je namerno pokrivao
// samo M17 (`INTERNAL_PANEL`), ova dopuna zatvara M8 deo (M15 spec §6.5.5). M7 ostaje van
// obima (čeka poseban prolaz, isto kao ranije). `context` je rezervisano mesto za budući filter
// (npr. trenutna stranica) — nije korišćeno u ovom prolazu. `lang` je nov (B2C_SITE prosleđuje
// aktivan jezik sajta radi lokalizovanih rezultata pretrage proizvoda/pomoći).
export class OmnisearchQueryDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsIn(['INTERNAL_PANEL', 'B2C_SITE'])
  channel!: 'INTERNAL_PANEL' | 'B2C_SITE';

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  // M15 spec §6.5.1 dopuna (22.8.2026, na zahtev vlasnika) — vidljiv tekst trenutno otvorenog
  // taba u M17 panelu (INTERNAL_PANEL kanal), automatski prilagan na svaku poruku. Server-side
  // ograničen na PAGE_CONTENT_MAX_CHARS (vidi omnisearch.service.ts) bez obzira šta klijent
  // pošalje — odbrana u dubinu, ne oslanja se samo na klijentsko sečenje.
  @IsOptional()
  @IsString()
  pageContent?: string;

  @IsOptional()
  @IsIn(LANGUAGE_CODES)
  lang?: (typeof LANGUAGE_CODES)[number];

  // Dopuna 25.8.2026, vidi OmnisearchHistoryTurnDto iznad. Server ionako seče na poslednjih 6
  // tura (omnisearch.service.ts) bez obzira šta klijent pošalje — odbrana u dubinu.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OmnisearchHistoryTurnDto)
  history?: OmnisearchHistoryTurnDto[];
}
