import { Injectable } from '@nestjs/common';
import { AllotmentMode, LanguageCode, Prisma, ProductType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarkupRulesService } from '../markup-rules/markup-rules.service';
import { IntegrationsService } from '../../m4-integracije-api/integrations.service';
import { resolveTranslation } from '../../m2-katalog-proizvoda/products/language-fallback';
import { applyMarkup } from '../common/markup-formula';
import { assertRoomConfigMatchesTotals, computeRoomBaseCost, OccupancyInput, RoomTypeDefinition } from '../common/occupancy';
import { TOLERANCE_MS } from '../common/date-mismatch';
import { isRefundableForPackage, isRefundableFromCancellationRules, isRefundableFromQuoteCancellationPolicy } from '../common/refundability';
import { CountrySuggestion, DestinationSuggestion, SearchResultOffer, SearchResultProduct } from './search-result.types';
import { SearchChannel } from './dto/search-query.dto';

export interface SearchParamsInput {
  type?: ProductType[];
  destinationCountry?: string;
  destinationCity?: string;
  stayFrom?: string;
  stayTo?: string;
  occupancy?: OccupancyInput;
  channel: SearchChannel;
  /** `minLon,minLat,maxLon,maxLat` — okvir mape (§3.0h.8). */
  bbox?: string;
  lang?: LanguageCode;
  /** M2 spec §2.3 `attributes.cabin_class` — samo FLIGHT. */
  cabinClass?: string;
  /** M5 spec §3.0d.1/3.0d.2/3.0d.3, dopuna 1.9.2026 — FLIGHT/TRANSFER/opšti TRANSPORT čitaju
   * `attributes.route.origin_city`; TRANSPORT/RENT_A_CAR čita `attributes.pickup_location`. */
  originCity?: string;
  /** M2 spec §2.3 `attributes.min_driver_age` — samo TRANSPORT/RENT_A_CAR; proizvod prolazi ako nema
   * ovaj atribut ili ako je tražena starost >= minimalne. */
  minDriverAge?: number;
  /** M2 spec §2.3 `attributes.duration_nights` — samo CRUISE, tačno poklapanje. */
  durationNights?: number;
  /** M2 spec §2.3 `attributes.cabin_types[].category` — samo CRUISE, proizvod prolazi ako BILO KOJA
   * stavka niza ima traženu kategoriju. */
  cabinType?: string;
  /** M2 spec §2.3c `attributes.amenities[]` (AmenityTag), M5 spec §3.0c.3 — samo ACCOMMODATION,
   * proizvod prolazi samo ako njegov niz sadrži SVE tražene tagove (I-logika, ne ILI). */
  amenityTags?: string[];
}

const DEFAULT_LANGUAGE: LanguageCode = 'sr';
const ROOM_BASED_TYPES: ProductType[] = ['ACCOMMODATION', 'PACKAGE'];
const CAPACITY_BEARING_MODES: AllotmentMode[] = ['FIXED', 'CHARTER', 'FIXED_LEASE'];

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly markupRules: MarkupRulesService,
    private readonly integrations: IntegrationsService,
  ) {}

  // M5 spec §3.0b/§11 — GET /search: M2 katalog + M3 ugovorena dostupnost + M4 uživo, sa
  // već primenjenom maržom. Filtrira SOLD_OUT ponude pre odgovora (§3.0b.2).
  /**
   * M5 spec §3.0c.2, korak 1 — predlaganje država dok se kuca. Vraća SAMO države u kojima
   * postoji bar jedan vidljiv `ACTIVE` proizvod: aplikacija ne nudi ćorsokak.
   *
   * NAPOMENA O PODACIMA (nalaz 2.9.2026): `Product.destination_country` u bazi meša ISO kodove
   * i srpske nazive ("RS" i "Srbija" stoje kao dve različite države, uz "Grčka", "Crna Gora").
   * Ovaj endpoint namerno vraća vrednost KAKVA JESTE, ne pokušava da je normalizuje — pretraga
   * filtrira po tačnoj vrednosti, pa bi prevođenje ovde vratilo predlog koji ništa ne nalazi.
   * Sređivanje samih podataka je zaseban zadatak (backlog).
   */
  async suggestCountries(q: string | undefined, channel: SearchChannel): Promise<CountrySuggestion[]> {
    const grouped = await this.prisma.product.groupBy({
      by: ['destinationCountry'],
      where: {
        status: 'ACTIVE',
        ...(channel === 'INTERNAL_PANEL' ? {} : { visibleChannels: { has: channel } }),
        ...(q ? { destinationCountry: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      _count: { _all: true },
      orderBy: { destinationCountry: 'asc' },
    });
    return grouped
      .filter((g) => Boolean(g.destinationCountry))
      .map((g) => ({ country: g.destinationCountry, count: g._count._all }));
  }

  /**
   * M5 spec §3.0c.2, korak 2 — predlaganje destinacija za izabranu državu, uz prečicu na ime
   * proizvoda. Vraća mešovitu listu: gradove te države i proizvode čiji naziv odgovara upitu.
   *
   * Bez `q` vraća SVE destinacije te države — vlasnikov zahtev (2.9.2026): čim se izabere
   * država, polje za mesto odmah nudi sve njene destinacije, bez kucanja. Sa `q` se sužava,
   * i tada se traži i po imenu proizvoda, pa se do hotela može doći i kad njegov grad nije
   * u ponuđenoj listi.
   */
  async suggestDestinations(
    country: string,
    q: string | undefined,
    channel: SearchChannel,
    lang: string | undefined,
  ): Promise<DestinationSuggestion[]> {
    const visible = channel === 'INTERNAL_PANEL' ? {} : { visibleChannels: { has: channel } };

    const cities = await this.prisma.product.groupBy({
      by: ['destinationCity'],
      where: {
        status: 'ACTIVE',
        destinationCountry: country,
        ...visible,
        ...(q ? { destinationCity: { contains: q, mode: 'insensitive' as const } } : {}),
      },
      _count: { _all: true },
      orderBy: { destinationCity: 'asc' },
    });

    const suggestions: DestinationSuggestion[] = cities
      .filter((c) => Boolean(c.destinationCity))
      .map((c) => ({ type: 'DESTINATION' as const, city: c.destinationCity, country, count: c._count._all }));

    // Prečica na naziv objekta — traži se samo kad korisnik nešto kuca, inače bi lista svake
    // države počela spiskom svih njenih hotela.
    if (q && q.trim().length >= 2) {
      const products = await this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          destinationCountry: country,
          ...visible,
          translations: { some: { name: { contains: q, mode: 'insensitive' } } },
        },
        include: { translations: true },
        take: 10,
      });
      for (const p of products) {
        const translation = resolveTranslation(p.translations, (lang as LanguageCode) ?? DEFAULT_LANGUAGE);
        suggestions.push({
          type: 'PRODUCT',
          city: p.destinationCity,
          country,
          productId: p.id,
          name: translation?.name ?? '',
          count: 1,
        });
      }
    }
    return suggestions;
  }

  async search(params: SearchParamsInput): Promise<SearchResultProduct[]> {
    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
      // M2 spec §5.1 — visible_channels kontroliše samo gde se proizvod PRIKAZUJE gostima/
      // subagentima (B2C_SITE/B2B_PORTAL/MOBILE); interni tim (INTERNAL_PANEL) vidi svaki
      // ACTIVE proizvod bez obzira na to polje (autorizacija za ovaj kanal je već sprovedena
      // u SearchController pre poziva ovde — vidi napomenu u search-query.dto.ts).
      ...(params.channel === 'INTERNAL_PANEL' ? {} : { visibleChannels: { has: params.channel } }),
    };
    if (params.type && params.type.length > 0) where.type = { in: params.type };
    if (params.destinationCountry) where.destinationCountry = params.destinationCountry;
    if (params.destinationCity) where.destinationCity = params.destinationCity;

    // M5 spec §3.0h.8 — okvir mape kao filter. Proizvod bez koordinata NE ulazi u rezultat kad
    // je okvir zadat: on se ne vidi ni na mapi, pa bi u listi bio red koji nema svoju tačku.
    if (params.bbox) {
      const [minLon, minLat, maxLon, maxLat] = params.bbox.split(',').map(Number);
      where.geoLat = { gte: minLat, lte: maxLat };
      where.geoLng = { gte: minLon, lte: maxLon };
    }

    let products = await this.prisma.product.findMany({
      where,
      include: { translations: true, sourceContract: true },
    });

    // M5 spec §11 v1.28 (17.8.2026) — filteri specifični po tipu proizvoda, ožičeni 22.8.2026
    // (M17 popup pretraga otkrila da su ovi parametri bili definisani u spec-u ali nikad stigli
    // u kod). U JS-u nad već dobijenim skupom (mala kolekcija po pretrazi, isti princip kao
    // SOLD_OUT filtriranje ispod) — bezbednije od Prisma JSON path operatora nad ugnježdenim
    // nizom (`cabin_types[]`) i izbegava dupliranje `where` grananja za svaki od 4 parametra.
    if (params.cabinClass) {
      products = products.filter((p) => (p.attributes as any)?.cabin_class === params.cabinClass);
    }
    if (params.originCity) {
      products = products.filter((p) => {
        const attrs = p.attributes as any;
        // TRANSPORT/RENT_A_CAR ima sopstvena imenovana polja (M2 spec §2.3) — origin_city
        // filtrira mesto preuzimanja, ne ugnježđen `route` (koji taj podtip uopšte nema).
        if (p.type === 'TRANSPORT' && attrs?.transport_mode === 'RENT_A_CAR') {
          return attrs?.pickup_location === params.originCity;
        }
        return attrs?.route?.origin_city === params.originCity;
      });
    }
    if (params.minDriverAge) {
      products = products.filter((p) => {
        const min = (p.attributes as any)?.min_driver_age;
        return !min || params.minDriverAge! >= min;
      });
    }
    if (params.durationNights) {
      products = products.filter((p) => (p.attributes as any)?.duration_nights === params.durationNights);
    }
    if (params.cabinType) {
      products = products.filter((p) => {
        const cabinTypes = (p.attributes as any)?.cabin_types;
        return Array.isArray(cabinTypes) && cabinTypes.some((c: any) => c?.category === params.cabinType);
      });
    }
    // M5 spec §3.0c.3 (dopuna 26.8.2026, na zahtev vlasnika — filteri za vođenu pretragu
    // smeštaja koji su bili specificirani ali nikad ožičeni) — I-logika: proizvod prolazi
    // samo ako `attributes.amenities[]` sadrži SVAKI traženi tag, ne bar jedan.
    if (params.amenityTags && params.amenityTags.length > 0) {
      products = products.filter((p) => {
        const amenities = (p.attributes as any)?.amenities;
        return Array.isArray(amenities) && params.amenityTags!.every((tag) => amenities.includes(tag));
      });
    }

    const results: SearchResultProduct[] = [];
    for (const product of products) {
      // M5 spec §3.0d.6/§3.0d.6a — PACKAGE nikad nema sopstveni ugovor, sopstvena grana bez
      // obzira na `sourceType` (uvek prazan/nebitan za ovaj tip proizvoda).
      const offers =
        product.type === 'PACKAGE'
          ? await this.buildPackageOffers(product, params)
          : product.sourceType === 'CONTRACTED'
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
        geoLat: product.geoLat === null ? null : Number(product.geoLat),
        geoLng: product.geoLng === null ? null : Number(product.geoLng),
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
      const isRefundable = isRefundableFromCancellationRules(period.cancellationRules);

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
          isRefundable,
          packageDepartureDate: null,
        });
      }
    }
    return offers;
  }

  /**
   * M5 spec §3.0d.6/§3.0d.6a (grupni paket) — `PACKAGE` nikad nema sopstveni `ContractPeriod`;
   * dostupni "termini" (tačni datumi polaska) su PRESEK `stayFrom` vrednosti preko FIXED/CHARTER
   * perioda sastojaka koji tu obavezu nose (§3.0d.6a: "ako nijedan uključeni proizvod nema fiksan
   * period, taj PACKAGE jednostavno ne kvalifikuje kao grupni"). Sastojci BEZ fiksne obaveze —
   * `API` (M4 živ poziv) — ne određuju termine, ali SE CENUJU za svaki već utvrđen termin (dopuna
   * 31.8.2026, ispravka: mešanje CONTRACTED+API sastojaka u grupnom paketu je stvaran zahtev, ne
   * van obima kako je prvobitno pretpostavljeno).
   */
  // §3.0d.6/§3.0d.6a (v1.94, vlasnikova korekcija) — termin dolazi SA paketa (`PackageDeparture`),
  // ne izvodi se presekom perioda sastojaka. Sastojci se proveravaju PROTIV već zadatog prozora
  // `[departureDate, returnDate]`: fiksni (CONTRACTED) sastojak mora imati `ContractPeriod` koji
  // taj prozor POKRIVA (isti obrazac kao `buildContractedOffers`, ne poklapanje tačnog datuma),
  // dinamički (API) sastojak se ceni uživo za isti prozor. Broj noćenja za cenu je uvek
  // `duration_days` paketa, NIKAD dužina sastojkovog sopstvenog perioda (ranija verzija je to
  // mešala — sezonski hotelski period bi bio naplaćen kao da je jedan dugačak boravak).
  private async buildPackageOffers(
    product: Prisma.ProductGetPayload<{ include: { translations: true; sourceContract: true } }>,
    params: SearchParamsInput,
  ): Promise<SearchResultOffer[]> {
    const includedIds = ((product.attributes as any)?.included_products ?? []) as string[];
    if (includedIds.length === 0) return [];

    const durationDays = (product.attributes as any)?.duration_days;
    if (typeof durationDays !== 'number' || durationDays <= 0) return [];

    const departures = await this.prisma.packageDeparture.findMany({
      where: {
        productId: product.id,
        status: 'ACTIVE',
        ...(params.stayFrom
          ? {
              departureDate: {
                gte: new Date(new Date(params.stayFrom).getTime() - TOLERANCE_MS),
                lte: new Date(new Date(params.stayFrom).getTime() + TOLERANCE_MS),
              },
            }
          : {}),
      },
      orderBy: { departureDate: 'asc' },
    });
    if (departures.length === 0) return [];

    const components = await this.prisma.product.findMany({
      where: { id: { in: includedIds } },
      include: { sourceContract: true },
    });
    if (components.length === 0) return [];

    const contractedComponents = components.filter((c) => c.sourceType === 'CONTRACTED');
    const dynamicComponents = components.filter((c) => c.sourceType === 'API' && c.sourceProvider && c.sourceExternalId);
    if (contractedComponents.length === 0 && dynamicComponents.length === 0) return [];

    const roomsRequested = params.occupancy?.roomConfig?.length ?? 1;
    const offers: SearchResultOffer[] = [];

    for (const departure of departures) {
      const windowFrom = departure.departureDate;
      const windowTo = departure.returnDate;

      let currency: string | null = null;
      let unavailable = false;
      let fixedTotal = 0;
      const cancellationSummaries: string[] = [];
      const fixedRefundableFlags: boolean[] = [];

      for (const component of contractedComponents) {
        if (!component.sourceContractId || !component.sourceContract) {
          unavailable = true; // §3.0b.2 — sastojak bez ugovora ne može pokriti nijedan prozor
          break;
        }

        // Noćenje-zasnovani sastojak (smeštaj) mora imati period koji POKRIVA ceo prozor
        // `[departureDate, returnDate]` (isti obrazac kao `buildContractedOffers`). "Tačkasti"
        // sastojak (let, transfer...) nema pojam noćenja — dovoljno je da mu POLAZAK (stayFrom)
        // padne unutar tolerancije termina, isto poređenje kao stara verzija ovog metoda pre
        // v1.94. Oba tolerišu ±1 dan (§3.0e.3a).
        const isRoomBased = ROOM_BASED_TYPES.includes(component.type);
        const periods = await this.prisma.contractPeriod.findMany({
          where: {
            contractId: component.sourceContractId,
            allotmentMode: { in: CAPACITY_BEARING_MODES },
            ...(isRoomBased
              ? { stayFrom: { lte: new Date(windowFrom.getTime() + TOLERANCE_MS) }, stayTo: { gte: new Date(windowTo.getTime() - TOLERANCE_MS) } }
              : { stayFrom: { gte: new Date(windowFrom.getTime() - TOLERANCE_MS), lte: new Date(windowFrom.getTime() + TOLERANCE_MS) } }),
          },
          include: { rateLines: { include: { agePricing: true } }, cancellationRules: true },
        });

        const roomTypes = ((component.attributes as any)?.roomTypes ?? (component.attributes as any)?.room_types ?? []) as RoomTypeDefinition[];
        let best: { finalPrice: number; period: (typeof periods)[number] } | null = null;

        for (const period of periods) {
          const remaining = (period.totalCapacity ?? 0) - period.unitsSold;
          if (remaining < roomsRequested) continue; // SOLD_OUT za ovaj period, §3.0b.2
          if (period.rateLines.length === 0) continue;

          const markupRule = await this.markupRules.resolveForContracted({
            productId: component.id,
            contractPeriodId: period.id,
            contractId: component.sourceContractId,
            supplierId: component.sourceContract.supplierId,
          });
          for (const rateLine of period.rateLines) {
            let baseCost: number;
            if (isRoomBased && params.occupancy) {
              const roomConfig = assertRoomConfigMatchesTotals(params.occupancy);
              const roomType = roomTypes.find((r) => r.code === period.roomType) ?? { code: period.roomType, capacityAdults: 99, capacityChildren: 99 };
              baseCost = roomConfig.reduce(
                (sum, room) =>
                  sum +
                  computeRoomBaseCost({
                    room,
                    roomType,
                    rateLine: { price: rateLine.price, priceBasis: rateLine.priceBasis, occupancy: rateLine.occupancy, cribFeePerNight: rateLine.cribFeePerNight },
                    agePricingCandidates: rateLine.agePricing,
                    nights: durationDays,
                  }),
                0,
              );
            } else if (isRoomBased) {
              // Noćenje-zasnovan sastojak bez detaljne popune (occupancy) — i dalje se cени po
              // noćenju, samo bez raščlanjivanja po sobama (nema roomConfig da se primeni).
              baseCost = rateLine.price * durationDays;
            } else {
              // Tačkasti sastojak — flat cena, bez množenja noćenjima (isti obrazac kao
              // `buildContractedOffers` za ne-paket FLIGHT/TRANSFER proizvode).
              baseCost = rateLine.price;
            }
            const finalPrice = applyMarkup(baseCost, markupRule);
            if (!best || finalPrice < best.finalPrice) best = { finalPrice, period };
          }
        }

        if (!best) {
          unavailable = true; // nijedan period ne pokriva ovaj prozor — §3.0b.2 SOLD_OUT princip
          break;
        }
        if (currency === null) currency = component.sourceContract.currency;
        else if (currency !== component.sourceContract.currency) {
          // Sabiranje preko sastojaka pretpostavlja istu valutu — obračun konverzije je M10 posao.
          unavailable = true;
          break;
        }
        fixedTotal += best.finalPrice;
        fixedRefundableFlags.push(isRefundableFromCancellationRules(best.period.cancellationRules));
        if (best.period.cancellationRules.length > 0) {
          cancellationSummaries.push(best.period.cancellationRules.map((r) => `${r.daysBeforeStay} dana: ${r.refundPercentage}%`).join(', '));
        }
      }
      if (unavailable) continue;

      let dynamicTotal = 0;
      const dynamicRefundableFlags: boolean[] = [];
      for (const dynamicComponent of dynamicComponents) {
        const quote = await this.integrations.checkAvailabilityAndPrice(dynamicComponent.sourceProvider!, dynamicComponent.sourceExternalId!, {
          stayFrom: windowFrom.toISOString().slice(0, 10),
          stayTo: windowTo.toISOString().slice(0, 10),
          adults: params.occupancy?.adults ?? 1,
          children: params.occupancy?.children ?? 0,
        });
        if (quote.availableUnits <= 0) { unavailable = true; break; } // §3.0b.2
        if (currency !== null && quote.currency !== currency) { unavailable = true; break; }
        if (currency === null) currency = quote.currency;
        const dynamicMarkupRule = await this.markupRules.resolveForApi({ productId: dynamicComponent.id, providerCode: dynamicComponent.sourceProvider! });
        dynamicTotal += applyMarkup(quote.priceAmount, dynamicMarkupRule);
        dynamicRefundableFlags.push(
          isRefundableFromQuoteCancellationPolicy(quote.cancellationPolicy.map((r) => ({ refundPercentage: r.refund_percentage }))),
        );
      }
      if (unavailable || currency === null) continue;

      offers.push({
        roomTypeCode: null,
        roomTypeName: null,
        boardType: null,
        priceBasis: null,
        finalPrice: fixedTotal + dynamicTotal,
        finalPriceCurrency: currency,
        availabilityStatus: 'AVAILABLE',
        rateLineId: null,
        providerQuoteReference: null,
        quoteExpiresAt: null,
        cancellationPolicySummary: cancellationSummaries.length > 0 ? cancellationSummaries.join(' | ') : null,
        // §3.0d.6/refundability.ts — vlasnikova odluka (1.9.2026): najstroži sastojak odlučuje za CEO paket.
        isRefundable: isRefundableForPackage([...fixedRefundableFlags, ...dynamicRefundableFlags]),
        packageDepartureDate: windowFrom.toISOString().slice(0, 10),
      });
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
        isRefundable: isRefundableFromQuoteCancellationPolicy(
          quote.cancellationPolicy.map((r) => ({ refundPercentage: r.refund_percentage })),
        ),
        packageDepartureDate: null,
      },
    ];
  }
}
