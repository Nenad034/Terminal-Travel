// M15 spec §9 — POST /omnisearch response shape.
export interface MatchedRoute {
  label: string;
  href: string;
}

export interface EntityResult {
  type: 'BOOKING' | 'PRODUCT';
  id: string;
  label: string;
  href: string;
  /** M2 Product.media[] — §6.5.4 tačka 2: prosleđuje se direktno, bez jezičkog opisa. */
  media?: { url: string; category: string }[] | null;
}

export interface OmnisearchResponse {
  active: boolean;
  matchedRoutes: MatchedRoute[];
  entityResults: EntityResult[];
  aiAnswer?: string;
  /**
   * M15 spec §6.5.4.6 (17.9.2026) — `true` kad je `aiAnswer` POTPITANJE (agentu je falila
   * destinacija/period/sastav putnika za pretragu raspoloživosti), ne odgovor. Kanal na to
   * zadržava fokus u polju za unos i vraća turu kao `history[].clarification = true`, da server
   * može da izbroji krugove (najviše dva) bez trajne memorije razgovora.
   */
  clarification?: boolean;
}
