import { TipNastupanja } from '@prisma/client';

// M5 spec §4.0a — automatsko izvođenje Booking.tip_nastupanja za samouslužne kanale.
export type M5Channel = 'B2C_SITE' | 'B2B_PORTAL' | 'MOBILE' | 'INTERNAL_PANEL' | 'PHONE' | 'MCP_AGENT';

// MCP_AGENT dodat avgust 2026 (M16) — nema ljudski nalog u toku (isti razlog kao B2C_SITE/
// MOBILE/B2B_PORTAL), pa i on mora automatski izvesti tip_nastupanja i zahtevati clickwrap
// (contract_terms_accepted) pre potvrde — M16 spec §4 "bez olakšica".
export const SELF_SERVICE_CHANNELS: M5Channel[] = ['B2C_SITE', 'B2B_PORTAL', 'MOBILE', 'MCP_AGENT'];

export interface TipNastupanjaResolutionResult {
  resolved: TipNastupanja | null;
  conflicting: boolean;
}

// M5 spec §4.0a, koraci 1-2 — za svaku QuoteItem izvedi kandidat vrednost, proveri slaganje.
export function resolveTipNastupanja(candidates: (TipNastupanja | null)[]): TipNastupanjaResolutionResult {
  const nonNull = candidates.filter((c): c is TipNastupanja => c != null);
  if (nonNull.length !== candidates.length) {
    // bar jedna stavka nema podrazumevanu vrednost (Contract/ProviderConfig bez default_tip_nastupanja)
    return { resolved: null, conflicting: true };
  }
  const unique = new Set(nonNull);
  if (unique.size !== 1) {
    return { resolved: null, conflicting: true };
  }
  return { resolved: nonNull[0], conflicting: false };
}

export function isSelfServiceChannel(channel: M5Channel): boolean {
  return SELF_SERVICE_CHANNELS.includes(channel);
}
