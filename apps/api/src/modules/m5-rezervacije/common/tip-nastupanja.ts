import { TipNastupanja } from '@prisma/client';

// M5 spec §4.0a — automatsko izvođenje Booking.tip_nastupanja za samouslužne kanale.
export type M5Channel = 'B2C_SITE' | 'B2B_PORTAL' | 'MOBILE' | 'INTERNAL_PANEL' | 'PHONE';

export const SELF_SERVICE_CHANNELS: M5Channel[] = ['B2C_SITE', 'B2B_PORTAL', 'MOBILE'];

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
