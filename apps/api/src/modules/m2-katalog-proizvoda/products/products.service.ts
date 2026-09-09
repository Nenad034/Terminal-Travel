import {
  PaginationQueryDto,
  paginated,
  paginationArgs,
} from '../../../common/pagination/pagination';
import { BadRequestException, Injectable, NotImplementedException } from '@nestjs/common';
import {
  MarkupScopeType,
  LanguageCode,
  Prisma,
  ProductStatus,
  ProductType,
  VisibleChannel,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';
import { PublishProductDto } from './dto/publish-product.dto';
import { CreatePackageDepartureDto } from './dto/create-package-departure.dto';
import { resolveTranslation, hasRequiredTranslationsForPublish } from './language-fallback';
import { applyDefaultAgePolicyToRoomTypes } from './age-policy';
import { toPublicProduct } from './public-product.serializer';
import { normalizeDestinationCountry } from '../../../common/destination-country';

const DEFAULT_LANGUAGE: LanguageCode = 'sr';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
  ) {}

  /** Popunjava attributes.room_types[] podrazumevanim age_policy gde nedostaje (M2 spec §2.3b). */
  private withResolvedAttributes<T extends { attributes: Prisma.JsonValue }>(product: T): T {
    const attrs = (product.attributes ?? {}) as { room_types?: unknown[] };
    if (!Array.isArray(attrs.room_types)) return product;
    return {
      ...product,
      attributes: {
        ...attrs,
        room_types: applyDefaultAgePolicyToRoomTypes(attrs.room_types as any[]),
      },
    };
  }

  // Internal (M17) — pun oblik, uključuje source_* polja (M2 spec §5.1, izuzetak za interni kanal).
  async findAll(
    filters: {
      type?: ProductType;
      destinationCountry?: string;
      status?: ProductStatus;
      channel?: VisibleChannel;
      lang?: LanguageCode;
    },
    pagination?: PaginationQueryDto,
  ) {
    // Straničenje (5.9.2026, dok. 39 nalaz 2.2) je ovde NAMERNO OPCIONO, ne podrazumevano.
    //
    // Razlog je vlasnikova odluka već upisana u `apps/panel/.../katalog/page.tsx`: filteri
    // kataloga (vrsta/država/destinacija/konekcija) rade TRENUTNO, nad celom već dovučenom
    // listom, bez novog poziva serveru — isti princip kao filteri pretrage (M5 §3.0c.3b).
    // Podrazumevano straničenje bi te filtere tiho svelo na jednu stranicu: korisnik bi
    // filtrirao 50 od 217 proizvoda i mislio da vidi sve. Zato bez `page`/`limit` ovaj poziv
    // i dalje vraća SVE redove, samo u novom obliku `{ data, total, ... }`.
    //
    // OGRANIČENJE KOJE OSTAJE OTVORENO: čim se uključi API dobavljač (M4), „sve" postaje
    // desetine hiljada zapisa i ova odluka više neće važiti — tada filtriranje mora na server,
    // a straničenje postati podrazumevano. Zavedeno u backlogu, nije prećutano.
    const where = {
      type: filters.type,
      destinationCountry: filters.destinationCountry,
      status: filters.status,
      visibleChannels: filters.channel ? { has: filters.channel } : undefined,
    };
    const wantsPage = pagination?.page !== undefined || pagination?.limit !== undefined;
    const { skip, take, page, limit } = paginationArgs(pagination);
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        // `supplierName` na listi (9.9.2026, vlasnikov zahtev za filterom po dobavljaču na
        // ekranu /katalog, M17 §7a). Dobavljač stoji na DVA mesta i to nije propust: ugovoreni
        // proizvod ga ima posredno kroz ugovor (M3), a ručno uneta usluga direktno
        // (`Product.supplierId`, M2 §2.1 dopuna 3.9.2026). Ovde se razrešava jedno ili drugo,
        // pa ekran ne mora da zna razliku.
        include: {
          translations: true,
          supplier: { select: { name: true } },
          sourceContract: { select: { supplier: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...(wantsPage ? { skip, take } : {}),
      }),
      this.prisma.product.count({ where }),
    ]);

    const lang = filters.lang ?? DEFAULT_LANGUAGE;
    return paginated(
      products.map(({ supplier, sourceContract, ...p }) => ({
        ...this.withResolvedAttributes(p),
        translation: resolveTranslation(p.translations, lang),
        // Ime, ne cela dva ugnježdena objekta — `include` je sredstvo, ne oblik odgovora.
        supplierName: supplier?.name ?? sourceContract?.supplier?.name ?? null,
      })),
      total,
      wantsPage ? page : 1,
      wantsPage ? limit : Math.max(1, total),
    );
  }

  async findOne(id: string, lang?: LanguageCode) {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      include: { translations: true },
    });
    return {
      ...this.withResolvedAttributes(product),
      translation: resolveTranslation(product.translations, lang ?? DEFAULT_LANGUAGE),
    };
  }

  // M2 spec §5.1/§7 — javni kanali (M7/M8/M9-gost): samo ACTIVE + vidljivo na traženom
  // kanalu, i NIKAD source_* polja (uklonjena serializerom, ne samo sakrivena od prikaza).
  async findAllPublic(channel: VisibleChannel, lang?: LanguageCode) {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE', visibleChannels: { has: channel } },
      include: { translations: true },
      orderBy: { createdAt: 'desc' },
    });
    return products.map((p) => {
      const { translations, ...resolved } = this.withResolvedAttributes(p);
      return {
        ...toPublicProduct(resolved),
        translation: resolveTranslation(translations, lang ?? DEFAULT_LANGUAGE),
      };
    });
  }

  async findOnePublic(id: string, channel: VisibleChannel, lang?: LanguageCode) {
    const product = await this.prisma.product.findFirstOrThrow({
      where: { id, status: 'ACTIVE', visibleChannels: { has: channel } },
      include: { translations: true },
    });
    const { translations, ...resolved } = this.withResolvedAttributes(product);
    return {
      ...toPublicProduct(resolved),
      translation: resolveTranslation(translations, lang ?? DEFAULT_LANGUAGE),
    };
  }

  // M2 spec §7 — POST /products: "ručno kreiranje CONTRACTED proizvoda".
  async create(dto: CreateProductDto, actorId: string) {
    const product = await this.prisma.product.create({
      data: {
        type: dto.type,
        sourceType: 'CONTRACTED',
        sourceContractId: dto.sourceContractId,
        // M2 spec §2.1 — naziv države se svodi na jedan oblik pri UPISU (`RS` → `Srbija`).
        // Bez ovoga se katalog ponovo raslojava: filter po jednom obliku ne nalazi proizvode
        // upisane pod drugim (zatečeno 3.9.2026: `RS` 24 proizvoda naspram `Srbija` 2).
        destinationCountry: normalizeDestinationCountry(dto.destinationCountry),
        destinationCity: dto.destinationCity,
        destinationArea: dto.destinationArea,
        status: 'DRAFT',
        cacheStatus: 'N_A',
        createdBy: actorId,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product.created',
      resourceType: 'Product',
      resourceId: product.id,
      afterState: product,
      context: {},
    });
    return product;
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const before = await this.prisma.product.findUniqueOrThrow({ where: { id } });

    // §5.2 (v1.26) — vezivanje za ugovor. Dve ograde, obe zato što bi tiho pogrešna veza dala
    // proizvod koji izgleda ispravno a u pretrazi se ponaša neobjašnjivo:
    //  1. proizvod iz M4 keširanja pripada provajderu, ne našem ugovoru (§3.2);
    //  2. nepostojeći ugovor bi prošao kao FK greška bez razumljive poruke.
    if (dto.sourceContractId !== undefined) {
      if (before.sourceType !== 'CONTRACTED') {
        throw new BadRequestException(
          'Za ugovor se može vezati samo proizvod iz sopstvenog ugovora (sourceType = CONTRACTED)',
        );
      }
      if (dto.sourceContractId !== null) {
        const contract = await this.prisma.contract.findUnique({
          where: { id: dto.sourceContractId },
          select: { id: true },
        });
        if (!contract) throw new BadRequestException('Zadati ugovor ne postoji');
      }
    }

    const after = await this.prisma.product.update({
      where: { id },
      data: {
        sourceContractId: dto.sourceContractId,
        destinationCountry: normalizeDestinationCountry(dto.destinationCountry),
        destinationCity: dto.destinationCity,
        destinationArea: dto.destinationArea,
        geoLat: dto.geoLat,
        geoLng: dto.geoLng,
        media: dto.media as unknown as Prisma.InputJsonValue,
        attributes: dto.attributes as unknown as Prisma.InputJsonValue,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product.updated',
      resourceType: 'Product',
      resourceId: id,
      beforeState: before,
      afterState: after,
      context: {},
    });
    return after;
  }

  // DELETE = arhiviranje (M2 spec §7), ne fizičko brisanje.
  async archive(id: string, actorId: string) {
    const before = await this.prisma.product.findUniqueOrThrow({ where: { id } });
    const after = await this.prisma.product.update({ where: { id }, data: { status: 'ARCHIVED' } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product.archived',
      resourceType: 'Product',
      resourceId: id,
      beforeState: { status: before.status },
      afterState: { status: after.status },
      context: {},
    });
    return after;
  }

  async listTranslations(productId: string) {
    return this.prisma.productTranslation.findMany({
      where: { productId },
      orderBy: { languageCode: 'asc' },
    });
  }

  async upsertTranslation(productId: string, dto: UpsertTranslationDto, actorId: string) {
    const translation = await this.prisma.productTranslation.upsert({
      where: { productId_languageCode: { productId, languageCode: dto.languageCode } },
      create: {
        productId,
        languageCode: dto.languageCode,
        name: dto.name,
        description: dto.description,
        slug: dto.slug,
        translationSource: dto.translationSource ?? 'MANUAL',
        isReviewed: dto.isReviewed ?? true,
      },
      update: {
        name: dto.name,
        description: dto.description,
        slug: dto.slug,
        translationSource: dto.translationSource ?? 'MANUAL',
        isReviewed: dto.isReviewed ?? true,
      },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product_translation.upserted',
      resourceType: 'ProductTranslation',
      resourceId: translation.id,
      afterState: translation,
      context: { productId, languageCode: dto.languageCode },
    });
    return translation;
  }

  /**
   * §5.2 (v1.26) — spremnost za objavu: prebrojana lista šta nedostaje da bi se proizvod uopšte
   * pojavio u pretrazi (M5 §3.0b). Uslovi su lanac od pet karika i otkazuje bilo koja, pa poruka
   * „nešto nedostaje" ne pomaže — vraća se stavka po stavka.
   *
   * PREPREKA zaustavlja objavu, UPOZORENJE ne. Razlika je namerna: „nema cene" znači da se
   * proizvod ne može prodati, „nema koordinata" znači da se neće videti na mapi; spajanje to
   * dvoje navodi čoveka da odustane zbog sitnice ili da preskoči ono što je bitno.
   */
  async publishReadiness(id: string): Promise<{
    productId: string;
    status: string;
    canPublish: boolean;
    checks: {
      key: string;
      label: string;
      ok: boolean;
      blocking: boolean;
      detail: string | null;
    }[];
  }> {
    const product = await this.prisma.product.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        sourceType: true,
        sourceContractId: true,
        geoLat: true,
        geoLng: true,
        attributes: true,
      },
    });

    const translations = await this.prisma.productTranslation.findMany({
      where: { productId: id },
      select: { languageCode: true },
    });

    const periods = product.sourceContractId
      ? await this.prisma.contractPeriod.findMany({
          where: { contractId: product.sourceContractId },
          select: { id: true, roomType: true, _count: { select: { rateLines: true } } },
        })
      : [];
    const periodiSaCenom = periods.filter((x) => x._count.rateLines > 0);

    // Marža se traži po ISTOM lancu kao pri prodaji (M5 §2.2: proizvod → period → ugovor →
    // dobavljač, najspecifičnije pobeđuje). `MarkupRule` je polimorfan — `scopeType` +
    // `scopeId`, bez FK — pa se ne može pitati preko relacije.
    const contract = product.sourceContractId
      ? await this.prisma.contract.findUnique({
          where: { id: product.sourceContractId },
          select: { supplierId: true },
        })
      : null;
    const markupScopes: { scopeType: MarkupScopeType; scopeId: string }[] = [
      { scopeType: 'M2_PRODUCT', scopeId: product.id },
      ...periods.map((x) => ({ scopeType: 'M3_CONTRACT_PERIOD' as const, scopeId: x.id })),
      ...(product.sourceContractId
        ? [{ scopeType: 'M3_CONTRACT' as const, scopeId: product.sourceContractId }]
        : []),
      ...(contract ? [{ scopeType: 'M3_SUPPLIER' as const, scopeId: contract.supplierId }] : []),
    ];
    const markupCount = await this.prisma.markupRule.count({ where: { OR: markupScopes } });

    // Tipovi soba iz perioda moraju da postoje u `attributes.room_types[]`, inače pretraga računa po
    // rezervnom kapacitetu i rezultat ostaje bez naziva sobe (search.service.ts).
    const attrs = (product.attributes ?? {}) as Record<string, unknown>;
    const roomTypeCodes = new Set(
      (((attrs.room_types ?? attrs.roomTypes) as { code?: string }[] | undefined) ?? [])
        .map((r) => r?.code)
        .filter((c): c is string => Boolean(c)),
    );
    const nepoznatiTipovi = [...new Set(periods.map((x) => x.roomType))].filter(
      (rt) => !roomTypeCodes.has(rt),
    );

    const checks = [
      {
        key: 'translations',
        label: 'Srpski i engleski prevod',
        ok: hasRequiredTranslationsForPublish(translations),
        blocking: true,
        detail: hasRequiredTranslationsForPublish(translations)
          ? null
          : 'Nedostaje prevod — bez oba jezika objava se odbija (§2.2).',
      },
      {
        key: 'contract',
        label: 'Vezan za ugovor',
        ok: Boolean(product.sourceContractId),
        blocking: true,
        detail: product.sourceContractId
          ? null
          : 'Proizvod nije vezan ni za jedan ugovor — pretraga nema odakle da uzme cenu.',
      },
      {
        key: 'periods',
        label: 'Ugovor ima period',
        ok: periods.length > 0,
        blocking: true,
        detail:
          periods.length > 0
            ? `${periods.length} perioda`
            : 'Ugovor nema nijedan period (datumi boravka, tip sobe, kapacitet).',
      },
      {
        key: 'rates',
        label: 'Period ima cenu',
        ok: periodiSaCenom.length > 0,
        blocking: true,
        detail:
          periodiSaCenom.length > 0
            ? `${periodiSaCenom.length} od ${periods.length} perioda ima cenovnu liniju`
            : 'Nijedan period nema cenovnu liniju — period bez cene ne proizvodi ponudu.',
      },
      {
        key: 'roomTypes',
        label: 'Tipovi soba se poklapaju',
        ok: nepoznatiTipovi.length === 0,
        blocking: false,
        detail:
          nepoznatiTipovi.length === 0
            ? null
            : `Ugovor koristi tipove soba kojih nema u katalogu: ${nepoznatiTipovi.join(', ')}. Pretraga radi, ali po rezervnom kapacitetu i bez naziva sobe.`,
      },
      {
        key: 'coordinates',
        label: 'Koordinate popunjene',
        ok: product.geoLat !== null && product.geoLng !== null,
        blocking: false,
        detail:
          product.geoLat !== null && product.geoLng !== null
            ? null
            : 'Proizvod se neće pojaviti na mapi pretrage.',
      },
      {
        key: 'markup',
        label: 'Marža postavljena',
        ok: markupCount > 0,
        // PREPREKA, ne upozorenje. `MarkupRuleService.resolveForContracted` (M5 §2.2) BACA kad
        // ne nađe pravilo ni na jednom od četiri nivoa, a `SearchService` taj izuzetak ne hvata
        // — objavljen proizvod bez marže ne prodaje se po nabavnoj ceni nego obara CELU pretragu,
        // i to i za sve ostale proizvode u istom upitu.
        blocking: true,
        detail:
          markupCount > 0
            ? null
            : 'Nema pravila marže ni na jednom nivou (proizvod → period → ugovor → dobavljač). Bez njega pretraga puca, ne samo za ovaj proizvod.',
      },
    ];

    return {
      productId: product.id,
      status: product.status,
      canPublish: checks.every((c) => c.ok || !c.blocking),
      checks,
    };
  }

  // M2 spec §7 — POST /products/:id/publish. §2.2 — sr+en obavezni pre DRAFT → ACTIVE.
  async publish(id: string, dto: PublishProductDto, actorId: string) {
    const before = await this.prisma.product.findUniqueOrThrow({ where: { id } });
    const enteringActive = before.status !== 'ACTIVE';

    if (enteringActive) {
      // §5.2 (v1.26) — nabraja SVE prepreke odjednom, ne prvu na koju naiđe. Ekran koji
      // prikazuje listu je pogodnost; ovaj endpoint je pravilo i mora da važi i za poziv koji
      // ne dolazi sa tog ekrana.
      const readiness = await this.publishReadiness(id);
      const prepreke = readiness.checks.filter((c) => c.blocking && !c.ok);
      if (prepreke.length > 0) {
        throw new BadRequestException(
          'Objava nije moguća — nedostaje: ' +
            prepreke.map((c) => `${c.label.toLowerCase()} (${c.detail})`).join('; '),
        );
      }
    }

    const after = await this.prisma.product.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        visibleChannels: dto.visibleChannels,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'product.published',
      resourceType: 'Product',
      resourceId: id,
      beforeState: { status: before.status, visibleChannels: before.visibleChannels },
      afterState: { status: after.status, visibleChannels: after.visibleChannels },
      context: {},
    });

    if (enteringActive) {
      // M2 spec §4.1 — Event Bus: koristi ga M12 za automatsko generisanje nacrta sadržaja.
      await this.eventBus.emit('M2', 'product.published', { productId: id });
    }

    return after;
  }

  // M5 spec §3.0d.6 (v1.94) — CRUD termina grupnog paketa živi u M2 (strukturni podatak o
  // proizvodu, isto mesto kao ostali PACKAGE atributi), M5 samo čita ACTIVE redove.
  async listPackageDepartures(productId: string) {
    return this.prisma.packageDeparture.findMany({
      where: { productId },
      orderBy: { departureDate: 'asc' },
    });
  }

  async createPackageDeparture(productId: string, dto: CreatePackageDepartureDto, actorId: string) {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: productId } });
    if (product.type !== 'PACKAGE') {
      throw new BadRequestException(
        'Termini polaska postoje samo za PACKAGE proizvode (M5 spec §3.0d.6)',
      );
    }
    const durationDays = (product.attributes as any)?.duration_days;
    if (typeof durationDays !== 'number' || durationDays <= 0) {
      throw new BadRequestException(
        'Proizvod mora imati attributes.duration_days pre dodavanja termina (M5 spec §3.0d.6)',
      );
    }
    const departureDate = new Date(dto.departureDate);
    const returnDate = new Date(departureDate.getTime() + durationDays * 86_400_000);

    const departure = await this.prisma.packageDeparture.create({
      data: { productId, departureDate, returnDate, status: 'ACTIVE' },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'package_departure.created',
      resourceType: 'PackageDeparture',
      resourceId: departure.id,
      afterState: departure,
      context: { productId },
    });
    return departure;
  }

  async cancelPackageDeparture(productId: string, departureId: string, actorId: string) {
    const before = await this.prisma.packageDeparture.findFirstOrThrow({
      where: { id: departureId, productId },
    });
    const after = await this.prisma.packageDeparture.update({
      where: { id: departureId },
      data: { status: 'CANCELLED' },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M2',
      action: 'package_departure.cancelled',
      resourceType: 'PackageDeparture',
      resourceId: departureId,
      beforeState: { status: before.status },
      afterState: { status: after.status },
      context: { productId },
    });
    return after;
  }

  // M2 spec §7 — POST /products/cache/sync. API-sourced sinhronizacija zavisi od M4
  // (§3.2, stavka 3) koji još nije implementiran — vidi M2 spec izlazni kriterijum,
  // stavka 2 ("kad taj modul bude spreman"). CONTRACTED nema pojam keširanja (§3.1).
  async syncCache(id: string) {
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id } });
    if (product.sourceType === 'CONTRACTED') {
      throw new BadRequestException(
        'CONTRACTED proizvod nema keširan sadržaj — sinhronizacija se ne primenjuje (M2 spec §3.1)',
      );
    }
    throw new NotImplementedException(
      'Sinhronizacija API-sourced sadržaja zahteva M4 (Integracije API), koji još nije implementiran (M2 spec §3.2)',
    );
  }
}
