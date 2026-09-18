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
  /**
   * M15 spec §6.5.4.9 (18.9.2026) — `generate_report` alat je pripremio fajl za preuzimanje.
   * Isti prolazan (30 min, memorija procesa) `report-store.ts` zapis kao BiTerminalAgent §6.9.3,
   * isti download endpoint (`GET /bi-terminal/reports/:id/download`) — samo drugačija (šira)
   * provera dozvole po `sourceAgent`, vidi `report-store.ts`.
   */
  report?: { id: string; format: 'EXCEL' | 'PDF' | 'HTML'; fileName: string };
  /**
   * M15 spec §6.5.4.8 (18.9.2026) — `compose_email` alat je PREDLOŽIO nov mejl, ništa nije
   * upisano. Isti dvostepeni obrazac kao `pendingWebFetch` (BiTerminalAgent §6.9.7) — stvaran
   * upis nacrta ide isključivo kroz `POST .../compose-email/approve`, ljudski pokrenut klik.
   */
  pendingEmailDraft?: {
    to: string;
    subject: string;
    body: string;
    mailboxId: string;
    mailboxAddress: string;
  };
}
