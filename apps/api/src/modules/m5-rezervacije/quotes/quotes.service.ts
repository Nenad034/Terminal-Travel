import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QuoteItemBuilderService } from './quote-item-builder.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

// M5 spec §3.1 — "expires_at = najkraći quote_expires_at među stavkama (M4) ili
// podrazumevanih 30 min za čisto ugovorene stavke."
const DEFAULT_QUOTE_EXPIRY_MINUTES = 30;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: QuoteItemBuilderService,
  ) {}

  // M5 spec §3.1/§3.2/§3.0b.3 — POST /quotes: konstruiše sve stavke po ISTIM pravilima
  // cene/marže kao POST /itineraries/:id/to-quote (deljeno preko QuoteItemBuilderService).
  async create(dto: CreateQuoteDto, actor: { userId?: string } | null) {
    const built = await Promise.all(
      dto.items.map((item) =>
        this.builder.build({
          productId: item.productId,
          stayFrom: item.stayFrom,
          stayTo: item.stayTo,
          occupancy: item.occupancy,
          rateLineId: item.rateLineId ?? null,
          providerQuoteReference: item.providerQuoteReference ?? null,
          selectedOfferQuoteExpiresAt: item.selectedOfferQuoteExpiresAt ?? null,
        }),
      ),
    );

    const apiExpiries = built.map((b) => b.quoteExpiresAt).filter((v): v is string => v != null);
    const expiresAt =
      apiExpiries.length > 0
        ? new Date(Math.min(...apiExpiries.map((v) => new Date(v).getTime())))
        : new Date(Date.now() + DEFAULT_QUOTE_EXPIRY_MINUTES * 60_000);

    const quote = await this.prisma.quote.create({
      data: {
        clientAccountId: dto.clientAccountId,
        channel: dto.channel,
        status: 'DRAFT',
        expiresAt,
        contractTermsAccepted: dto.contractTermsAccepted ?? false,
        contractTermsAcceptedAt: dto.contractTermsAccepted ? new Date() : null,
        createdBy: actor?.userId ?? null,
        referralTrackingCode: dto.referralTrackingCode,
        items: {
          create: built.map((b) => ({
            productId: b.productId,
            sourceType: b.sourceType,
            stayFrom: b.stayFrom,
            stayTo: b.stayTo,
            occupancy: b.occupancy as any,
            baseCost: b.baseCost,
            baseCostCurrency: b.baseCostCurrency,
            rateLineId: b.rateLineId,
            markupRuleId: b.markupRuleId,
            finalPrice: b.finalPrice,
            finalPriceCurrency: b.finalPriceCurrency,
            providerQuoteReference: b.providerQuoteReference,
            unitCount: b.unitCount,
            cancellationPolicySnapshot: b.cancellationPolicySnapshot as any,
          })),
        },
      },
      include: { items: true },
    });

    return quote;
  }

  // M5 spec §11 — GET /quotes/:id: "pregled ponude, uključujući da li je istekla."
  async findOne(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, include: { items: true } });
    if (!quote) throw new NotFoundException(`Ponuda ${id} nije pronađena.`);
    return { ...quote, isExpired: quote.status === 'DRAFT' && quote.expiresAt.getTime() < Date.now() };
  }
}
