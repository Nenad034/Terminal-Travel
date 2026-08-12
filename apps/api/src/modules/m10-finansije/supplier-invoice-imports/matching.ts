import { similarity, DEFAULT_NAME_SIMILARITY_THRESHOLD } from '../../m5-rezervacije/common/fuzzy-match';
import { PrismaService } from '../../../prisma/prisma.service';

// M10 spec §8.6.3 — determinizam, ne slobodan AI izbor: kandidati su SupplierObligation istog
// supplier_id čiji invoice_reference je i dalje prazan, filtrirano po preklapanju stay perioda
// preko booking_item_id; unutar tog skupa poredi se ime gosta istim fuzzy-match mehanizmom kao
// M5 §6.4 (normalizacija + Levenshtein), amount služi kao dodatna potvrda (ne odbacuje kandidata).
export const MATCH_CONFIDENCE_THRESHOLD = 85;

export interface MatchResult {
  matchedSupplierObligationId: string | null;
  matchConfidence: number | null;
}

export async function findBestSupplierObligationMatch(
  prisma: PrismaService,
  params: {
    supplierId: string;
    extractedGuestName: string;
    extractedStayFrom: Date;
    extractedStayTo: Date;
    extractedAmount: number;
  },
): Promise<MatchResult> {
  const candidates = await prisma.supplierObligation.findMany({
    where: { supplierId: params.supplierId, invoiceReference: null },
    include: { bookingItem: { include: { guests: true } } },
  });

  let best: { id: string; confidence: number } | null = null;

  for (const candidate of candidates) {
    const item = candidate.bookingItem;
    if (!item) continue;
    const overlaps = item.stayFrom < params.extractedStayTo && item.stayTo > params.extractedStayFrom;
    if (!overlaps) continue;

    let bestNameScore = 0;
    for (const guest of item.guests) {
      const fullExtracted = params.extractedGuestName;
      const fullGuest = `${guest.guestFirstName} ${guest.guestLastName}`;
      const score = similarity(fullExtracted, fullGuest);
      if (score > bestNameScore) bestNameScore = score;
    }
    if (bestNameScore < DEFAULT_NAME_SIMILARITY_THRESHOLD) continue;

    // Odstupanje iznosa umanjuje pouzdanost (ne odbacuje kandidata — §8.0/§8.6.3).
    const amountDeviation = candidate.amountOriginal > 0 ? Math.abs(candidate.amountOriginal - params.extractedAmount) / candidate.amountOriginal : 0;
    const amountPenalty = Math.min(amountDeviation, 0.5); // do 50 procentnih poena kazne
    const confidence = Math.round((bestNameScore - amountPenalty) * 100);

    if (!best || confidence > best.confidence) best = { id: candidate.id, confidence };
  }

  if (!best) return { matchedSupplierObligationId: null, matchConfidence: null };
  return { matchedSupplierObligationId: best.id, matchConfidence: best.confidence };
}
