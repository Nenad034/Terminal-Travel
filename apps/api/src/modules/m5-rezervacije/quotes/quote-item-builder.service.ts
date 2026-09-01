import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarkupRulesService } from '../markup-rules/markup-rules.service';
import { IntegrationsService } from '../../m4-integracije-api/integrations.service';
import { applyMarkup } from '../common/markup-formula';
import { assertRoomConfigMatchesTotals, computeRoomBaseCost, OccupancyInput, RoomTypeDefinition, AgePolicyEntry } from '../common/occupancy';
import { TOLERANCE_MS } from '../common/date-mismatch';

const ROOM_BASED_TYPES = ['ACCOMMODATION', 'PACKAGE'];

export interface BuildQuoteItemParams {
  productId: string;
  stayFrom: string;
  stayTo: string;
  occupancy: OccupancyInput;
  rateLineId?: string | null;
  providerQuoteReference?: string | null;
  // M5 spec §3.0b.3, korak 4 — quote_expires_at izabranog SearchResultOffer, ako postoji
  // (samo za API); provera isteka se izvodi PRE ponovnog čitanja cene od M4.
  selectedOfferQuoteExpiresAt?: string | null;
}

export interface BuiltQuoteItemData {
  productId: string;
  // M5 spec §3.0e.3a (dopuna 29.8.2026) — potreban da `QuotesService.create` razvrsta stavke u
  // PREVOZ/BORAVAK grupe za proveru neusklađenih datuma, bez ponovnog čitanja proizvoda iz baze.
  type: string;
  sourceType: 'CONTRACTED' | 'API';
  stayFrom: Date;
  stayTo: Date;
  occupancy: OccupancyInput;
  baseCost: number;
  baseCostCurrency: string;
  rateLineId: string | null;
  markupRuleId: string;
  finalPrice: number;
  finalPriceCurrency: string;
  providerQuoteReference: string | null;
  // M5 spec §3.1 — "expires_at = najkraći quote_expires_at među stavkama (M4) ili
  // podrazumevanih 30 min za čisto ugovorene stavke." null za CONTRACTED (§3.0b.2).
  quoteExpiresAt: string | null;
  // M5 spec §4.2 dopuna (v1.14) — broj rezervisanih jedinica (soba), iz room_config.length;
  // koristi se pri potvrdi (§4) i pri release-u kapaciteta (§6) da se oslobodi TAČAN broj.
  unitCount: number;
  // M5 spec §4.2 dopuna (v1.14) — samo za API stavke, snimak M4 cancellationPolicy u trenutku
  // građenja, da se refund% pri otkazivanju računa deterministički bez ponovnog poziva ka M4.
  cancellationPolicySnapshot: { daysBeforeStay: number; refundPercentage: number }[] | null;
}

/**
 * M5 spec §2.1/§3.2/§3.2a/§3.2b/§3.0b.3 — logika deljena između `POST /quotes` (poglavlje 3.2)
 * i `POST /itineraries/:id/to-quote` (poglavlje 3.0.3), tako da obe putanje primenjuju IDENTIČNA
 * pravila cene/marže/kapaciteta ("po istim pravilima cene/marže kao svaka druga stavka").
 */
@Injectable()
export class QuoteItemBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markupRules: MarkupRulesService,
    private readonly integrations: IntegrationsService,
  ) {}

  // M5 spec §3.0d.6a — vraća NIZ (ne jednu stavku): za obične proizvode niz od jednog elementa,
  // za `PACKAGE` (grupni paket) po jedna stavka za svaki `included_products[]` sastojak. Pozivaoci
  // (QuotesService/ItinerariesService) spljošćuju rezultat, isti obrazac za oba.
  async build(params: BuildQuoteItemParams): Promise<BuiltQuoteItemData[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: params.productId },
      include: { sourceContract: true },
    });
    if (!product) throw new NotFoundException(`Proizvod ${params.productId} nije pronađen.`);

    const roomConfig = assertRoomConfigMatchesTotals(params.occupancy);
    // §4.2 dopuna (v1.14) — broj jedinica (soba) je zajednički za oba izvora, izveden jednom ovde.
    const unitCount = roomConfig.length;

    if (product.type === 'PACKAGE') {
      // §3.0d.6 (v1.94) — PACKAGE nikad nema sopstveni ugovor; params.stayFrom je izabrani
      // termin (mora postojati kao ACTIVE PackageDeparture na paketu — isti dan koji je
      // GET /search vratio kao packageDepartureDate). params.stayTo se ne koristi — datum
      // povratka dolazi iz TOG termina (`PackageDeparture.returnDate`), ne od gosta.
      return this.buildPackage(product, new Date(params.stayFrom), params.occupancy, roomConfig, unitCount);
    }

    const stayFrom = new Date(params.stayFrom);
    const stayTo = new Date(params.stayTo);
    if (product.sourceType === 'CONTRACTED') {
      return [await this.buildContracted(product, stayFrom, stayTo, params.occupancy, roomConfig, params.rateLineId ?? null, unitCount)];
    }
    return [await this.buildApi(product, stayFrom, stayTo, params.occupancy, params.selectedOfferQuoteExpiresAt ?? null, unitCount)];
  }

  /**
   * M5 spec §3.0d.6/§3.0d.6a (v1.94, vlasnikova korekcija) — termin MORA već postojati kao
   * ACTIVE `PackageDeparture` na paketu (ne izvodi se iz sastojaka). Prozor cenovanja je taj
   * SAČUVAN par `(departureDate, returnDate)` — sastojci se proveravaju protiv njega: CONTRACTED
   * sastojak mora imati period koji ga POKRIVA (ne samo poklapanje datuma polaska), API sastojak
   * se ceni uživo za isti prozor. Broj noćenja je uvek dužina TOG prozora (= `duration_days` u
   * trenutku kad je termin dodat), nikad dužina sastojkovog sopstvenog perioda.
   */
  private async buildPackage(
    product: { id: string; attributes: unknown },
    terminDate: Date,
    occupancy: OccupancyInput,
    roomConfig: ReturnType<typeof assertRoomConfigMatchesTotals>,
    unitCount: number,
  ): Promise<BuiltQuoteItemData[]> {
    const includedIds = ((product.attributes as any)?.included_products ?? []) as string[];
    if (includedIds.length === 0) {
      throw new BadRequestException(`PACKAGE ${product.id} nema included_products[] (M2 spec §2.3).`);
    }

    const departure =
      (await this.prisma.packageDeparture.findFirst({
        where: { productId: product.id, status: 'ACTIVE', departureDate: terminDate },
      })) ??
      (await this.prisma.packageDeparture.findFirst({
        where: {
          productId: product.id,
          status: 'ACTIVE',
          departureDate: { gte: new Date(terminDate.getTime() - TOLERANCE_MS), lte: new Date(terminDate.getTime() + TOLERANCE_MS) },
        },
      }));
    if (!departure) {
      throw new BadRequestException(
        `PACKAGE ${product.id} nema aktivan termin polaska za ${terminDate.toISOString().slice(0, 10)} (M5 spec §3.0d.6).`,
      );
    }
    const windowFrom = departure.departureDate;
    const windowTo = departure.returnDate;

    const components = await this.prisma.product.findMany({
      where: { id: { in: includedIds } },
      include: { sourceContract: true },
    });

    const fixedItems: BuiltQuoteItemData[] = [];
    const dynamicComponents: typeof components = [];

    for (const component of components) {
      if (component.sourceType === 'API') {
        dynamicComponents.push(component);
        continue;
      }
      if (component.sourceType !== 'CONTRACTED' || !component.sourceContractId || !component.sourceContract) {
        throw new BadRequestException(`Sastojak ${component.id} paketa ${product.id} nema ni ugovor ni API konekciju (M2 spec §2.1).`);
      }
      // Noćenje-zasnovan sastojak (smeštaj) mora imati period koji POKRIVA ceo prozor (±1 dan
      // tolerancije na obe granice, §3.0e.3a). "Tačkasti" sastojak (let, transfer...) nema pojam
      // noćenja — dovoljno je da mu POLAZAK padne unutar tolerancije termina (isti princip kao
      // SearchService.buildPackageOffers).
      const isRoomBased = ROOM_BASED_TYPES.includes(component.type);
      const period = await this.prisma.contractPeriod.findFirst({
        where: {
          contractId: component.sourceContractId,
          allotmentMode: { in: ['FIXED', 'CHARTER', 'FIXED_LEASE'] },
          ...(isRoomBased
            ? { stayFrom: { lte: new Date(windowFrom.getTime() + TOLERANCE_MS) }, stayTo: { gte: new Date(windowTo.getTime() - TOLERANCE_MS) } }
            : { stayFrom: { gte: new Date(windowFrom.getTime() - TOLERANCE_MS), lte: new Date(windowFrom.getTime() + TOLERANCE_MS) } }),
        },
        include: { rateLines: { include: { agePricing: true } } },
        orderBy: { stayFrom: 'asc' },
      });
      if (!period || period.rateLines.length === 0) {
        throw new BadRequestException(
          `Sastojak ${component.id} paketa ${product.id} nema period koji pokriva termin ${windowFrom.toISOString().slice(0, 10)}–${windowTo.toISOString().slice(0, 10)} (M5 spec §3.0d.6).`,
        );
      }
      // Noćenje-zasnovan sastojak koristi ceo prozor (nights = duration_days paketa unutar
      // buildContracted); tačkasti sastojak dobija (windowFrom, windowFrom) — nights=0→1 unutar
      // buildContracted, isti flat obrazac kao normalna (ne-paket) tačkasta CONTRACTED stavka.
      fixedItems.push(
        await this.buildContracted(
          component,
          windowFrom,
          isRoomBased ? windowTo : windowFrom,
          occupancy,
          roomConfig,
          period.rateLines[0].id,
          unitCount,
        ),
      );
    }

    // Drugi prolaz — API sastojci, cenjeni uživo za isti prozor.
    const dynamicItems = await Promise.all(
      dynamicComponents.map((component) => this.buildApi(component, windowFrom, windowTo, occupancy, null, unitCount)),
    );

    return [...fixedItems, ...dynamicItems];
  }

  private async buildContracted(
    product: { id: string; type: string; sourceContractId: string | null; sourceContract: { id: string; supplierId: string; currency: string } | null; attributes: unknown },
    stayFrom: Date,
    stayTo: Date,
    occupancy: OccupancyInput,
    roomConfig: ReturnType<typeof assertRoomConfigMatchesTotals>,
    explicitRateLineId: string | null,
    unitCount: number,
  ): Promise<BuiltQuoteItemData> {
    if (!product.sourceContractId || !product.sourceContract) {
      throw new BadRequestException('CONTRACTED proizvod nema povezan ugovor (M2 spec §2.1).');
    }

    let rateLine = explicitRateLineId
      ? await this.prisma.rateLine.findUnique({ where: { id: explicitRateLineId }, include: { agePricing: true, contractPeriod: true } })
      : null;

    if (!rateLine) {
      const period = await this.prisma.contractPeriod.findFirst({
        where: { contractId: product.sourceContractId, stayFrom: { lte: stayFrom }, stayTo: { gte: stayTo } },
        include: { rateLines: { include: { agePricing: true } } },
        orderBy: { stayFrom: 'asc' },
      });
      if (!period || period.rateLines.length === 0) {
        throw new BadRequestException('Nema odgovarajućeg ContractPeriod/RateLine za tražene datume (M5 spec §3.2).');
      }
      const chosen = period.rateLines[0];
      rateLine = { ...chosen, contractPeriod: period };
    }

    const nights = Math.round((stayTo.getTime() - stayFrom.getTime()) / 86_400_000);
    const roomTypes = ((product.attributes as any)?.roomTypes ?? (product.attributes as any)?.room_types ?? []) as RoomTypeDefinition[];
    const roomType = roomTypes.find((r) => r.code === rateLine!.contractPeriod.roomType) ?? {
      code: rateLine!.contractPeriod.roomType,
      capacityAdults: 99,
      capacityChildren: 99,
    };

    const baseCost = ROOM_BASED_TYPES.includes(product.type)
      ? roomConfig.reduce(
          (sum, room) =>
            sum +
            computeRoomBaseCost({
              room,
              roomType,
              rateLine: {
                price: rateLine!.price,
                priceBasis: rateLine!.priceBasis,
                occupancy: rateLine!.occupancy,
                cribFeePerNight: rateLine!.cribFeePerNight,
              },
              agePricingCandidates: rateLine!.agePricing,
              agePolicyOverride: (rateLine!.contractPeriod.agePolicyOverride as AgePolicyEntry[] | null) ?? null,
              nights: nights || 1,
            }),
          0,
        )
      : rateLine.price * (nights || 1);

    const markupRule = await this.markupRules.resolveForContracted({
      productId: product.id,
      contractPeriodId: rateLine.contractPeriodId,
      contractId: product.sourceContractId,
      supplierId: product.sourceContract.supplierId,
    });
    const finalPrice = applyMarkup(baseCost, markupRule);

    return {
      productId: product.id,
      sourceType: 'CONTRACTED',
      stayFrom,
      stayTo,
      occupancy,
      type: product.type,
      baseCost,
      baseCostCurrency: product.sourceContract.currency,
      rateLineId: rateLine.id,
      markupRuleId: markupRule.id,
      finalPrice,
      finalPriceCurrency: product.sourceContract.currency,
      providerQuoteReference: null,
      quoteExpiresAt: null,
      unitCount,
      cancellationPolicySnapshot: null, // CONTRACTED koristi M3 CancellationRule uživo, §4.2 dopuna v1.14
    };
  }

  private async buildApi(
    product: { id: string; type: string; sourceProvider: string | null; sourceExternalId: string | null },
    stayFrom: Date,
    stayTo: Date,
    occupancy: OccupancyInput,
    selectedOfferQuoteExpiresAt: string | null,
    unitCount: number,
  ): Promise<BuiltQuoteItemData> {
    if (!product.sourceProvider || !product.sourceExternalId) {
      throw new BadRequestException('API proizvod nema povezanog provajdera (M2 spec §2.1).');
    }

    // M5 spec §3.0b.3, korak 4 — provera isteka pre kreiranja stavke, ODVOJENA od provere pri potvrdi (§4).
    if (selectedOfferQuoteExpiresAt && new Date(selectedOfferQuoteExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException(
        'Cena izabrane ponude je istekla (quote_expires_at) — ponovite pretragu (M5 spec §3.0b.3).',
      );
    }

    // korak 5 — cena se UVEK ponovo pribavlja od M4, nikad se ne preuzima slepo iz search rezultata.
    const quote = await this.integrations.checkAvailabilityAndPrice(product.sourceProvider, product.sourceExternalId, {
      stayFrom: stayFrom.toISOString().slice(0, 10),
      stayTo: stayTo.toISOString().slice(0, 10),
      adults: occupancy.adults,
      children: occupancy.children,
    });
    if (quote.availableUnits <= 0) {
      throw new BadRequestException('Provajder više nema slobodnih jedinica za ovu kombinaciju (M4 AvailabilityQuote).');
    }

    const markupRule = await this.markupRules.resolveForApi({ productId: product.id, providerCode: product.sourceProvider });
    const finalPrice = applyMarkup(quote.priceAmount, markupRule);

    return {
      productId: product.id,
      sourceType: 'API',
      stayFrom,
      stayTo,
      occupancy,
      type: product.type,
      baseCost: quote.priceAmount,
      baseCostCurrency: quote.currency,
      rateLineId: null,
      markupRuleId: markupRule.id,
      finalPrice,
      finalPriceCurrency: quote.currency,
      providerQuoteReference: quote.externalId,
      quoteExpiresAt: quote.quoteExpiresAt,
      unitCount,
      // §4.2 dopuna v1.14 — snimak M4 cancellationPolicy (isti oblik kao M3 CancellationRule),
      // radi determinističkog refund% pri otkazivanju bez ponovnog poziva ka M4.
      cancellationPolicySnapshot: quote.cancellationPolicy.map((p) => ({
        daysBeforeStay: p.days_before_stay,
        refundPercentage: p.refund_percentage,
      })),
    };
  }
}
