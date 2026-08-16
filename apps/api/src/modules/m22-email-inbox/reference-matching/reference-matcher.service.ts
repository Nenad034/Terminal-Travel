import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type ReferenceMatchType = 'EXACT_REFERENCE' | 'FUZZY_SUGGESTION' | 'NONE';

export interface ReferenceMatchResult {
  matchType: ReferenceMatchType;
  relatedSupplierManifestId: string | null;
  relatedSupplierChangeNoticeId: string | null;
}

const NO_MATCH: ReferenceMatchResult = { matchType: 'NONE', relatedSupplierManifestId: null, relatedSupplierChangeNoticeId: null };

// M22 spec §3.1a (M5 §8.8) — za nit u jedinstvenom sandučetu za dobavljače, svaka nova INBOUND
// poruka se proverava na obrazac `[REF: TT-NNNNNN]` u naslovu i telu, PRE fuzzy-match pokušaja.
// Korak 1: tačna referenca → predlog (nivo "Autonomno" za SAMO prepoznavanje, ništa se piše u
// M5 status). Korak 2: bez reference, fuzzy-match po dobavljaču/kontakt-mejlu — slabiji predlog,
// jasno obeležen drugačijim `matchType`. Korak 3 (konačna M5 potvrda) NIJE ovde — to je isključivo
// M5 `M5/supplier-confirmation/CONFIRM` (ljudski klik), M22 ga nikad ne poziva.
const REFERENCE_PATTERN = /\[REF:\s*(TT-\d+)\]/i;

// Fuzzy fallback je pojednostavljen u ovom prolazu (dokumentovano M22 spec §10): umesto punog
// poklapanja po imenu/datumima (M5 §6.4 obrazac), poredi domen from_address korespondenta sa
// Supplier.contactEmail domenom i predlaže najskoriju SENT stavku tog dobavljača bez potvrde —
// dovoljno za v1, jasno mesto za proširenje ako se pokaže nedovoljno u praksi.
const FUZZY_LOOKBACK_DAYS = 60;

@Injectable()
export class ReferenceMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async match(subject: string, body: string, fromAddress: string): Promise<ReferenceMatchResult> {
    const exact = await this.matchByReferenceCode(subject, body);
    if (exact.matchType !== 'NONE') return exact;

    return this.fuzzyMatchBySenderDomain(fromAddress);
  }

  private async matchByReferenceCode(subject: string, body: string): Promise<ReferenceMatchResult> {
    const referenceCode = extractReferenceCode(subject) ?? extractReferenceCode(body);
    if (!referenceCode) return NO_MATCH;

    const manifest = await this.prisma.supplierManifest.findUnique({ where: { referenceCode } });
    if (manifest) return { matchType: 'EXACT_REFERENCE', relatedSupplierManifestId: manifest.id, relatedSupplierChangeNoticeId: null };

    const changeNotice = await this.prisma.supplierChangeNotice.findUnique({ where: { referenceCode } });
    if (changeNotice) return { matchType: 'EXACT_REFERENCE', relatedSupplierManifestId: null, relatedSupplierChangeNoticeId: changeNotice.id };

    return NO_MATCH;
  }

  private async fuzzyMatchBySenderDomain(fromAddress: string): Promise<ReferenceMatchResult> {
    const domain = fromAddress.split('@')[1]?.trim().toLowerCase();
    if (!domain) return NO_MATCH;

    const since = new Date();
    since.setDate(since.getDate() - FUZZY_LOOKBACK_DAYS);

    const suppliers = await this.prisma.supplier.findMany({
      where: { contactEmail: { endsWith: `@${domain}`, mode: 'insensitive' } },
      select: { id: true },
    });
    if (suppliers.length === 0) return NO_MATCH;
    const supplierIds = suppliers.map((s) => s.id);

    // Napomena: SupplierChangeNotice nema direktan supplierId (veza ide preko BookingItem →
    // ContractPeriod → Supplier, van obima ove jednostavne v1 heuristike) — fuzzy fallback je
    // zato ograničen na SupplierManifest, dokumentovano pojednostavljenje (M22 spec §10).
    const latestManifest = await this.prisma.supplierManifest.findFirst({
      where: { supplierId: { in: supplierIds }, status: 'SENT', sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
    });
    if (latestManifest) {
      return { matchType: 'FUZZY_SUGGESTION', relatedSupplierManifestId: latestManifest.id, relatedSupplierChangeNoticeId: null };
    }

    return NO_MATCH;
  }
}

function extractReferenceCode(text: string): string | null {
  const match = text.match(REFERENCE_PATTERN);
  return match ? match[1].toUpperCase() : null;
}
