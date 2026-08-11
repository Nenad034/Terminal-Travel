import { Injectable } from '@nestjs/common';
import { LanguageCode, Prisma, ProductType, VisibleChannel } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarkupRulesService } from '../markup-rules/markup-rules.service';
import { IntegrationsService } from '../../m4-integracije-api/integrations.service';
import { resolveTranslation } from '../../m2-katalog-proizvoda/products/language-fallback';
import { applyMarkup } from '../common/markup-formula';
import { assertRoomConfigMatchesTotals, computeRoomBaseCost, OccupancyInput, RoomTypeDefinition } from '../common/occupancy';
import { SearchResultOffer, SearchResultProduct } from './search-result.types';

export interface SearchParamsInput {
  type?: ProductType[];
  destinationCountry?: string;
  destinationCity?: string;
  stayFrom?: string;
  stayTo?: string;
  occupancy?: OccupancyInput;
  channel: VisibleChannel;
  lang?: LanguageCode;
}

const DEFAULT_LANGUAGE: LanguageCode = 'sr';
const ROOM_BASED_TYPES: ProductType[] = ['ACCOMMODATION', 'PACKAGE'];
const CAPACITY_BEARING_MODES = ['FIXED', 'CHARTER', 'FIXED_LEASE'];

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markupRules: MarkupRulesService,
    private readonly integrations: IntegrationsService,
  ) {}

  // M5 spec §3.0b/§11 — GET /search: M2 katalog + M3 ugovorena dostupnost + M4 uživo, sa
  // već primenjenom maržom. Filtrira SOLD_OUT ponude pre odgovora (§3.0b.2).
  async search(params: SearchParamsInput): Promise<SearchResultProduct[]> {
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      visibleChannels: { has: params.channel },
    };
    if (params.type && params.type.length > 0) where.type = { in: params.type };
    if (params.destinationCountry) where.destinationCountry = params.destinationCountry;
    if (params.destinationCity) where.destinationCity = params.destinationCity;

    const products = await this.prisma.product.findMany({
      where,
      include: { translations: true, sourceContract: true },
    });

    const results: SearchResultProduct[] = [];
    for (const product of products) {
      const offers =
        product.sourceType === 'CONTRACTED'
          ? await this.buildContractedOffers(product, params)
          : await this.buildApiOffers(product, params);

      if (offers.length === 0) continue; // §3.0b.2 — SOLD_OUT/nedostupne ponude se ne vraćaju

      const translation = resolveTranslation(product.translations, params.lang ?? DEFAULT_LANGUAGE);
      const media = (product.media as unknown as { url: string; category: string; order: number }[]) ?? [];
      const thumbnail = this.pickThumbnail(media);

      results.push({
        productId: product.id,
        type: product.type,
        sourceType: product.sourceType,
        name: translation?.name ?? '',
        destinationCountry: product.destinationCountry,
        destinationCity: product.destinationCity,
        thumbnail,
        shortDescription: translation?.description?.slice(0, 240) ?? null,
        offers,
      });
    }
    return results;
  }

  private pickThumbnail(media: { url: string; category: string; order: number }[]): { url: string; category: string } | null {
    if (media.length === 0) return null;
    const sorted = [...media].sort((a, b) => a.order - b.order);
    const exterior = sorted.find((m) => m.category === 'EXTERIOR');
    const room = sorted.find((m) => m.category === 'ROOM');
    const pick = exterior ?? room ?? sorted[0];
    return { url: pick.url, category: pick.category };
  }

  private async buildContractedOffers(
    product: Prisma.ProductGetPayload<{ include: { translations: true; sourceContract: true } }>,
    params: SearchParamsInput,
  ): Promise<SearchResultOffer[]> {
    if (!product.sourceContractId || !product.sourceContract) return [];

    const periods = await this.prisma.contractPeriod.findMany({
      where: {
        contractId: product.sourceContractId,
        ...(params.stayFrom && params.stayTo
          ? { stayFrom: { lte: new Date(params.stayFrom) }, stayTo: { gte: new Date(params.stayTo) } }
          : {}),
      },
      include: { rateLines: { include: { agePricing: true } }, cancellationRules: true },
    });

    const roomsRequested = params.occupancy?.roomConfig?.length ?? 1;
    const roomTypes = ((product.attributes as any)?.roomTypes ?? (product.attributes as any)?.room_types ?? []) as RoomTypeDefinition[];
    const offers: SearchResultOffer[] = [];

    for (const period of periods) {
      let availabilityStatus: 'AVAILABLE' | 'ON_REQUEST' | 'SOLD_OUT' = 'AVAILABLE';
      if (period.allotmentMode === 'ON_REQUEST') {
        availabilityStatus = 'ON_REQUEST';
      } else if (CAPACITY_BEARING_MODES.includes(period.allotmentMode)) {
        const remaining = (period.totalCapacity ?? 0) - period.unitsSold;
        if (remaining < roomsRequested) continue; // SOLD_OUT — §3.0b.2, ne vraćati u rezultatima
        availabilityStatus = 'AVAILABLE';
      }

      const cancellationSummary =
        period.cancellationRules.length > 0
          ? period.cancellationRules
              .map((r) => `${r.daysBeforeStay} dana: ${r.refundPercentage}%`)
              .join(', ')
          : null;

      for (const rateLine of period.rateLines) {
        let baseCost: number;
        const needsRoomCalc = ROOM_BASED_TYPES.includes(product.type) && params.occupancy;
        if (needsRoomCalc) {
          const roomConfig = assertRoomConfigMatchesTotals(params.occupancy!);
          const roomType = roomTypes.find((r) => r.code === period.roomType) ?? {
            code: period.roomType,
            capacityAdults: 99,
            capacityChildren: 99,
          };
          const nights = Math.round((new Date(params.stayTo!).getTime() - new Date(params.stayFrom!).getTime()) / 86_400_000);
          baseCost = roomConfig.reduce(
            (sum, room) =>
              sum +
              computeRoomBaseCost({
                room,
                roomType,
                rateLine: { price: rateLine.price, priceBasis: rateLine.priceBasis, occupancy: rateLine.occupancy, cribFeePerNight: rateLine.cribFeePerNight },
                agePricingCandidates: rateLine.agePricing,
                nights: nights || 1,
              }),
            0,
          );
        } else {
          baseCost = rateLine.price;
        }

        const markupRule = await this.markupRules.resolveForContracted({
          productId: product.id,
          contractPeriodId: period.id,
          contractId: product.sourceContractId,
          supplierId: product.sourceContract.supplierId,
        });
        const finalPrice = applyMarkup(baseCost, markupRule);
        const roomTypeDef = roomTypes.find((r) => r.code === period.roomType);

        offers.push({
          roomTypeCode: ROOM_BASED_TYPES.includes(product.type) ? period.roomType : null,
          roomTypeName: (roomTypeDef as any)?.name ?? null,
          boardType: rateLine.boardType,
          priceBasis: rateLine.priceBasis,
          finalPrice,
          finalPriceCurrency: product.sourceContract.currency,
          availabilityStatus,
          rateLineId: rateLine.id,
          providerQuoteReference: null,
          quoteExpiresAt: null,
          cancellationPolicySummary: cancellationSummary,
        });
      }
    }
    return offers;
  }

  private async buildApiOffers(
    product: Prisma.ProductGetPayload<{ include: { translations: true; sourceContract: true } }>,
    params: SearchParamsInput,
  ): Promise<SearchResultOffer[]> {
    if (!product.sourceProvider || !product.sourceExternalId || !params.stayFrom || !params.stayTo) return [];

    const quote = await this.integrations.checkAvailabilityAndPrice(product.sourceProvider, product.sourceExternalId, {
      stayFrom: params.stayFrom,
      stayTo: params.stayTo,
      adults: params.occupancy?.adults ?? 1,
      children: params.occupancy?.children ?? 0,
    });
    if (quote.availableUnits <= 0) return []; // §3.0b.2 — ne vraćati SOLD_OUT

    const markupRule = await this.markupRules.resolveForApi({ productId: product.id, providerCode: product.sourceProvider });
    const finalPrice = applyMarkup(quote.priceAmount, markupRule);
    const cancellationSummary =
      quote.cancellationPolicy.length > 0
        ? quote.cancellationPolicy.map((r) => `${r.days_before_stay} dana: ${r.refund_percentage}%`).join(', ')
        : null;

    return [
      {
        roomTypeCode: null,
        roomTypeName: null,
        boardType: null,
        priceBasis: null,
        finalPrice,
        finalPriceCurrency: quote.currency,
        availabilityStatus: 'AVAILABLE',
        rateLineId: null,
        providerQuoteReference: quote.externalId,
        quoteExpiresAt: quote.quoteExpiresAt,
        cancellationPolicySummary: cancellationSummary,
      },
    ];
  }
}
