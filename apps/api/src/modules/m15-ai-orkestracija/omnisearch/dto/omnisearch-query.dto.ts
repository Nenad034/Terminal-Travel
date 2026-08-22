import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

const LANGUAGE_CODES = ['sr', 'en', 'hr', 'sl', 'es', 'de', 'ru', 'fr'] as const;

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
}
