import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Booking, BookingItem, PaymentStatus, Prisma, QuoteItem, TipNastupanja } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { ContractPeriodsService } from '../../m3-ugovaranje-alotmani/contract-periods/contract-periods.service';
import { IntegrationsService } from '../../m4-integracije-api/integrations.service';
import { QuoteItemBuilderService, BuiltQuoteItemData } from '../quotes/quote-item-builder.service';
import { ComplianceStubsService } from '../common/compliance-stubs.service';
import { ClientContractStubService } from '../common/client-contract-stub.service';
import { generateBookingNumber } from '../common/booking-number';
import { classifyByDay, toMidnightUtc } from '../common/calendar-classification';
import { namesMatch } from '../common/fuzzy-match';
import { isSelfServiceChannel, resolveTipNastupanja, M5Channel as M5ChannelType } from '../common/tip-nastupanja';
import { ConfirmQuoteDto } from './dto/confirm-quote.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ModifyBookingDto } from './dto/modify-booking.dto';
import { AddBookingItemDto } from './dto/add-booking-item.dto';
import { AddAncillaryItemDto } from './dto/add-ancillary-item.dto';
import { AddManualItemDto } from './dto/add-manual-item.dto';
import { applyMarkup } from '../common/markup-formula';
import { checkAncillaryOccupancy, computeAncillaryAmount, signedAncillaryAmount, type AncillaryServiceLike } from '../common/ancillary-pricing';
import { SupplierChangeNoticesService } from '../supplier-manifests/supplier-change-notices.service';
import { SupplierManifestsService } from '../supplier-manifests/supplier-manifests.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { resolveTranslation } from '../../m2-katalog-proizvoda/products/language-fallback';
import { SubagentStubService } from '../common/subagent-stub.service';
import { resolveApiContext } from '../common/resolve-api-context';
import { PermissionsService } from '../../m1-core-identitet/permissions/permissions.service';
import { SYSTEM_ROLES } from '../../m1-core-identitet/roles/system-roles.constants';

// M5 spec §6 dopuna (2.9.2026, na zahtev vlasnika) — vaučer prvi put dobija stvaran sadržaj
// (`GET /sales/bookings/public/:id/voucher`, `PublicVoucherController`), umesto mock spoljnog
// URL-a bez ijednog reda sadržaja. `WEB_APP_BASE_URL` (podrazumevano lokalni apps/web port iz
// .claude/launch.json) — namerno BEZ shareToken-a: `Booking.id` (UUID, 122 bita entropije) je
// isti "kapacitetski link" obrazac koji je mock URL već koristio (id direktno u putanji).
function buildVoucherUrl(bookingId: string): string {
  const base = process.env.WEB_APP_BASE_URL ?? 'http://localhost:3200';
  // apps/web nema middleware koji sam preusmerava bez lokala (`src/i18n/request.ts` baca 404
  // za putanju bez [locale] segmenta) — `sr` je `defaultLocale` (`src/i18n/config.ts`).
  return `${base}/sr/rezervacija/vaucer/${bookingId}`;
}

// M5 spec §7 dopuna (27.8.2026) — isti filter-oblik kao `findAll` iznad, minus datumski opseg
// (kalendar prikaz sam zadaje opseg). Deljen između `calendarSummary`/`calendarDay`.
export interface CalendarFilters {
  status?: string[];
  paymentStatus?: string[];
  tipNastupanja?: string[];
  buyerName?: string;
  bookingNumber?: string;
  currency?: string;
  createdFrom?: string;
  createdTo?: string;
  productType?: string[];
  productId?: string;
  destinationCity?: string;
  destinationCountry?: string;
  hasTravelGuarantee?: string;
}

interface ItemReservationOutcome {
  quoteItemId: string;
  itemStatus: 'CONFIRMED' | 'PENDING_SUPPLIER_CONFIRMATION';
  supplierReference: string;
  releaseHandle: (() => Promise<void>) | null;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
    private readonly contractPeriods: ContractPeriodsService,
    private readonly integrations: IntegrationsService,
    private readonly builder: QuoteItemBuilderService,
    private readonly compliance: ComplianceStubsService,
    private readonly clientContractStub: ClientContractStubService,
    private readonly changeNotices: SupplierChangeNoticesService,
    private readonly supplierManifests: SupplierManifestsService,
    private readonly subagentStub: SubagentStubService,
    private readonly permissions: PermissionsService,
  ) {}

  // M5 spec §6.5 (31.8.2026) — Vlasnik/Direktor zaobilaze ownership provere za prenos
  // vlasništva/direktno zaduženje; isti obrazac provere kao M19 InAppNotificationsService.
  private async isVlasnikOrDirektor(userId: string): Promise<boolean> {
    const match = await this.prisma.userRole.findFirst({
      where: { userId, role: { name: { in: [SYSTEM_ROLES.VLASNIK, SYSTEM_ROLES.DIREKTOR] } } },
    });
    return Boolean(match);
  }

  // M5 spec §6.2/§6.6 dopuna (31.8.2026, Faza 8 IDOR pregled). Nalaz: ista provera vlasništva/
  // zaduženja/franšizne granice iz `findOne` NIJE bila primenjena u `cancel`/`modify`/
  // `updatePaymentStatus`/`voucherOverride`/`assignGuide` — te metode su rezervaciju/stavku
  // učitavale direktno po ID-u bez ikakve provere konteksta, pa je gost/subagent/Prodajni agent
  // bez VIEW_ALL mogao pogađanjem/enumeracijom ID-a da izmeni/otkaže TUĐU rezervaciju. Izvučeno
  // u deljeni proverivač da svaki put koji menja stanje rezervacije prođe kroz isto pravilo.
  private async assertBookingAccessible(booking: { id?: string; clientAccountId: string; franchiseSubagentId: string | null; ownerId: string | null; assignedToId: string | null }, actorUserId: string): Promise<void> {
    const { context, ownClientAccountId, franchiseSubagentId } = await this.resolveApiContext(actorUserId);
    if (context !== 'INTERNAL_PANEL') {
      if (booking.clientAccountId !== ownClientAccountId) {
        // Ne otkrivati postojanje tuđe rezervacije — ista "ne otkrivati" filozofija
        // kao M1 requestPasswordReset (ne kaže da li email postoji).
        throw new NotFoundException('Rezervacija nije pronađena.');
      }
      return;
    }
    if (franchiseSubagentId && booking.franchiseSubagentId !== franchiseSubagentId) {
      throw new NotFoundException('Rezervacija nije pronađena.');
    }
    const hasViewAll = await this.permissions.hasPermission(actorUserId, 'M5', 'booking', 'VIEW_ALL');
    if (!hasViewAll && booking.ownerId !== actorUserId && booking.assignedToId !== actorUserId) {
      // §4.6/§6.6 dopuna (1.9.2026) — predstavnik na destinaciji (VODIC) nije ni `owner_id` ni
      // `assigned_to_id` (to su prodajne uloge), pa bi bez ovog izuzetka video 404 na rezervaciju
      // koju stvarno vodi na terenu — i ne bi mogao da upiše napomenu koju vlasnik traži.
      // Uže od VIEW_ALL: važi isključivo za rezervacije gde mu je stavka stvarno dodeljena.
      // Fail-closed: pristup se odobrava SAMO kad je broj dodeljenih stavki dokazano > 0.
      // Provera oblika `=== 0` bi propustila svaku vrednost koja nije broj (npr. greška upita),
      // što je za proveru pristupa pogrešan smer greške.
      const guidesThisBooking = booking.id
        ? await this.prisma.bookingItem.count({ where: { bookingId: booking.id, assignedGuideId: actorUserId } })
        : 0;
      if (!(guidesThisBooking > 0)) {
        throw new NotFoundException('Rezervacija nije pronađena.');
      }
    }
  }

  // ==========================================================================
  // M5 spec §4 — Quote → Booking
  // ==========================================================================
  async confirmQuote(quoteId: string, dto: ConfirmQuoteDto, actor: { userId: string }) {
    let quote = await this.prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
    if (!quote) throw new NotFoundException(`Ponuda ${quoteId} nije pronađena.`);

    // §6.2 obrazac dopune — gost sme da potvrdi isključivo sopstvenu Ponudu (client_account_id
    // je već primorano na sopstveni nalog pri POST /quotes, ova provera zatvara pokušaj
    // potvrde TUĐE ponude pogađanjem/enumeracijom quoteId).
    const { context, ownClientAccountId, franchiseSubagentId } = await this.resolveApiContext(actor.userId);
    if (context !== 'INTERNAL_PANEL' && quote.clientAccountId !== ownClientAccountId) {
      throw new NotFoundException(`Ponuda ${quoteId} nije pronađena.`);
    }

    if (quote.status !== 'DRAFT') {
      throw new BadRequestException(`Ponuda ${quoteId} nije u statusu DRAFT (status: ${quote.status}).`);
    }

    // korak 1 — istekla ponuda: ponovo izračunaj CENU/dostupnost pre nastavka.
    if (quote.expiresAt.getTime() < Date.now()) {
      quote = await this.recomputeExpiredQuote(quote);
    }

    // §3.1 — clickwrap pristanak obavezan pre plaćanja za samouslužne kanale.
    if (isSelfServiceChannel(quote.channel as M5ChannelType) && !quote.contractTermsAccepted) {
      throw new BadRequestException(
        'Quote.contract_terms_accepted mora biti true pre potvrde rezervacije za samouslužne kanale (M5 spec §3.1).',
      );
    }

    if (!quote.clientAccountId) {
      throw new BadRequestException('Ponuda nema povezan client_account_id — gost mora biti identifikovan pre potvrde rezervacije.');
    }

    // §4.1 dopuna (v1.17) — buyer_tax_id obavezan kad je buyer_type = PRAVNO_LICE (odbrana u dubinu,
    // pored @ValidateIf u ConfirmQuoteDto).
    if (dto.buyerType === 'PRAVNO_LICE' && !dto.buyerTaxId) {
      throw new BadRequestException('buyerTaxId je obavezan kad je buyerType PRAVNO_LICE (M5 spec §4.1).');
    }

    // §4.0a — određivanje tip_nastupanja.
    const tipNastupanja = await this.resolveBookingTipNastupanja(quote, dto.tipNastupanja);

    const totalPrice = quote.items.reduce((sum, i) => sum + i.finalPrice, 0);
    const currency = quote.items[0]?.finalPriceCurrency ?? 'EUR';

    // korak 1a/1b — redosled FIKSAN: garancija putovanja (M11) pa kreditni limit (M7).
    if (tipNastupanja === 'ORGANIZATOR') {
      const guarantee = await this.compliance.checkTravelGuaranteeUtilization({ bookingTotalPrice: totalPrice, currency });
      if (!guarantee.allowed) {
        throw new BadRequestException(
          guarantee.reason ?? 'Potvrda odbijena — prekoračenje limita garancije putovanja (M11, M5 spec §4 korak 1a).',
        );
      }
    }
    if (quote.clientAccountId) {
      const credit = await this.compliance.checkCreditLimitIfSubagent({
        clientAccountId: quote.clientAccountId,
        additionalAmount: totalPrice,
        currency,
      });
      if (credit.isSubagent && !credit.allowed) {
        throw new BadRequestException('Potvrda odbijena — prekoračenje kreditnog limita subagenta (M7, M5 spec §4 korak 1b).');
      }
    }

    // korak 2/3 — rezerviši svaku stavku; sve ili ništa.
    const outcomes: ItemReservationOutcome[] = [];
    try {
      for (const item of quote.items) {
        outcomes.push(await this.reserveQuoteItem(item, actor.userId));
      }
    } catch (err) {
      await this.releaseAll(outcomes);
      throw err;
    }

    // korak 4 — kreiraj Booking + BookingItem.
    const anyPending = outcomes.some((o) => o.itemStatus === 'PENDING_SUPPLIER_CONFIRMATION');
    const bookingStatus = anyPending ? 'PENDING_SUPPLIER_CONFIRMATION' : 'CONFIRMED';
    const bookingNumber = await this.nextBookingNumber();
    const now = new Date();

    const guestsByIndex = new Map<number, { firstName: string; lastName: string }[]>();
    for (const g of dto.guests ?? []) {
      const list = guestsByIndex.get(g.itemIndex) ?? [];
      list.push({ firstName: g.firstName, lastName: g.lastName });
      guestsByIndex.set(g.itemIndex, list);
    }

    const booking = await this.prisma.booking.create({
      data: {
        bookingNumber,
        clientAccountId: quote.clientAccountId,
        buyerName: dto.buyerName,
        buyerType: dto.buyerType,
        buyerTaxId: dto.buyerTaxId,
        channel: quote.channel,
        tipNastupanja,
        status: bookingStatus,
        paymentStatus: 'UNPAID',
        totalPrice,
        currency,
        confirmedAt: bookingStatus === 'CONFIRMED' ? now : null,
        createdBy: actor.userId,
        // M5 spec §6.5/§6.6 (31.8.2026) — vlasništvo i zaduženje počinju kod kreatora;
        // franšizna granica se hvata iz konteksta pozivaoca (STAFF vezan za FRANCHISE
        // subagenta preko resolveApiContext), prazno za matičnu agenciju/gost/B2B.
        ownerId: actor.userId,
        assignedToId: actor.userId,
        franchiseSubagentId,
        referralTrackingCode: quote.referralTrackingCode,
        // M20 spec §3.2 dopuna — prenosi već dati clickwrap pristanak (samouslužni kanali)
        // dalje na rezervaciju, da M20 zna da automatski prihvati ugovor bez ponovnog koraka.
        contractTermsAcceptedAt: quote.contractTermsAccepted ? quote.contractTermsAcceptedAt : null,
        items: {
          create: quote.items.map((item, idx) => {
            const outcome = outcomes[idx];
            const isApi = item.sourceType === 'API';
            return {
              productId: item.productId,
              sourceType: item.sourceType,
              supplierReference: outcome.supplierReference,
              stayFrom: item.stayFrom,
              stayTo: item.stayTo,
              baseCost: item.baseCost,
              baseCostCurrency: item.baseCostCurrency,
              rateLineId: item.rateLineId,
              markupRuleId: item.markupRuleId,
              finalPrice: item.finalPrice,
              finalPriceCurrency: item.finalPriceCurrency,
              itemStatus: outcome.itemStatus,
              unitCount: item.unitCount,
              cancellationPolicySnapshot: item.cancellationPolicySnapshot as any,
              // §8.6 — API stavke: najava/potvrda automatski, isti trenutak kao CONFIRMED.
              announcedAt: isApi ? now : null,
              supplierConfirmedAt: isApi ? now : null,
              guests: guestsByIndex.get(idx)
                ? { create: guestsByIndex.get(idx)!.map((g) => ({ guestFirstName: g.firstName, guestLastName: g.lastName })) }
                : undefined,
            };
          }),
        },
      },
      include: { items: true },
    });

    // §6.7a — OBAVEZNE doplate se povlače uz svaku stavku već pri prvoj rezervaciji, ne tek
    // kad neko naknadno doda uslugu. Ukupno zaduženje se posle toga preračunava (ON_SITE
    // doplate ostaju van zbira, vidi `recomputeBookingTotal`).
    let mandatoryAdded = 0;
    for (const created of booking.items) {
      mandatoryAdded += await this.attachMandatoryAncillaries(created.id);
    }
    if (mandatoryAdded > 0) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { totalPrice: await this.recomputeBookingTotal(booking.id) },
      });
    }

    await this.prisma.quote.update({ where: { id: quote.id }, data: { status: 'CONVERTED' } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.confirmed',
      resourceType: 'Booking',
      resourceId: booking.id,
      afterState: booking,
      context: { quoteId },
    });

    await this.eventBus.emit('M5', bookingStatus === 'CONFIRMED' ? 'booking.confirmed' : 'booking.pending_supplier_confirmation', {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
    });

    // §6.3 — sistemski izuzetak: subagent ACTIVE unutar kredita dobija vaučer automatski
    // čim Booking.status = CONFIRMED, nezavisno od payment_status.
    await this.maybeIssueVoucher(booking.id);

    // §6.2 dopuna (avgust 2026, otkriveno pri M16 verifikaciji) — RANIJE hardkodovano na
    // 'INTERNAL_PANEL', pa je confirmQuote uvek vraćao NEMASKIRAN prikaz (supplier_reference/
    // base_cost/markup_rule_id) direktno pozivaocu, bez obzira na kanal — isti odgovor koji
    // M8 bankovni prenos (payByBankTransferAction) i sada M16 confirm_booking prosleđuju
    // direktno gostu/spoljnom MCP klijentu. Pravi actor.userId daje ispravno INTERNAL_PANEL
    // za osoblje/sistemske aktore (resolveApiContext ionako pada na taj podrazumevani slučaj
    // kad korisnik ne postoji, npr. M10 SYSTEM_ACTOR) i ispravno B2C/B2B maskiranje za
    // GUEST/SUBAGENT_CONTACT/AI_AGENT — isti obrazac kao findAll/findOne.
    return this.findOne(booking.id, actor.userId);
  }

  private async recomputeExpiredQuote(quote: Prisma.QuoteGetPayload<{ include: { items: true } }>) {
    // M5 spec §3.0d.6a — PACKAGE se rasklapa na pojedinačne QuoteItem-e VEĆ pri kreiranju Ponude
    // (QuotesService.create/ItinerariesService.convertToQuote), pa `QuoteItem.productId` ovde
    // uvek referencira sastojak (ACCOMMODATION/FLIGHT/...), nikad sam PACKAGE — build() vraća
    // tačno jedan element po pozivu, isto kao pre §3.0d.6a dopune.
    const rebuilt = await Promise.all(
      quote.items.map(async (item) => {
        const built = await this.builder.build({
          productId: item.productId,
          stayFrom: item.stayFrom.toISOString(),
          stayTo: item.stayTo.toISOString(),
          occupancy: item.occupancy as any,
          rateLineId: item.rateLineId,
        });
        return built[0];
      }),
    );
    const apiExpiries = rebuilt.map((b) => b.quoteExpiresAt).filter((v): v is string => v != null);
    const newExpiresAt = apiExpiries.length > 0 ? new Date(Math.min(...apiExpiries.map((v) => new Date(v).getTime()))) : new Date(Date.now() + 30 * 60_000);

    await this.prisma.$transaction([
      ...rebuilt.map((b, idx) =>
        this.prisma.quoteItem.update({
          where: { id: quote.items[idx].id },
          data: {
            baseCost: b.baseCost,
            baseCostCurrency: b.baseCostCurrency,
            rateLineId: b.rateLineId,
            markupRuleId: b.markupRuleId,
            finalPrice: b.finalPrice,
            finalPriceCurrency: b.finalPriceCurrency,
            providerQuoteReference: b.providerQuoteReference,
            unitCount: b.unitCount,
            cancellationPolicySnapshot: b.cancellationPolicySnapshot as any,
          },
        }),
      ),
      this.prisma.quote.update({ where: { id: quote.id }, data: { expiresAt: newExpiresAt } }),
    ]);

    return this.prisma.quote.findUniqueOrThrow({ where: { id: quote.id }, include: { items: true } });
  }

  // §4.0a — automatsko izvođenje za samouslužne kanale; ručni izbor kao podrazumevana
  // vrednost za INTERNAL_PANEL/PHONE, sa mogućnošću eksplicitne promene (korak 4).
  private async resolveBookingTipNastupanja(
    quote: Prisma.QuoteGetPayload<{ include: { items: true } }>,
    explicitOverride: TipNastupanja | undefined,
  ): Promise<TipNastupanja> {
    const candidates = await Promise.all(
      quote.items.map(async (item) => {
        const product = await this.prisma.product.findUniqueOrThrow({
          where: { id: item.productId },
          include: { sourceContract: true },
        });
        if (item.sourceType === 'CONTRACTED') {
          return product.sourceContract?.defaultTipNastupanja ?? null;
        }
        if (!product.sourceProvider) return null;
        const config = await this.prisma.providerConfig.findUnique({ where: { providerCode: product.sourceProvider } });
        return config?.defaultTipNastupanja ?? null;
      }),
    );

    const resolution = resolveTipNastupanja(candidates);
    const isSelfService = isSelfServiceChannel(quote.channel as M5ChannelType);

    if (isSelfService) {
      if (resolution.conflicting || !resolution.resolved) {
        throw new BadRequestException(
          'Stavke ponude nose različit/nedefinisan tip_nastupanja — samouslužni kanal ne može sam da potvrdi rezervaciju (M5 spec §4.0a).',
        );
      }
      return resolution.resolved;
    }

    // INTERNAL_PANEL/PHONE — ručni izbor ima prioritet, inače podrazumevana izvedena vrednost.
    if (explicitOverride) return explicitOverride;
    if (!resolution.conflicting && resolution.resolved) return resolution.resolved;
    throw new BadRequestException(
      'Nije moguće odrediti podrazumevani tip_nastupanja (stavke se ne slažu) — potreban je eksplicitan ručni izbor (M5 spec §4.0a).',
    );
  }

  private async reserveQuoteItem(item: QuoteItem, actorId: string): Promise<ItemReservationOutcome> {
    if (item.sourceType === 'CONTRACTED') {
      if (!item.rateLineId) throw new BadRequestException(`QuoteItem ${item.id} (CONTRACTED) nema rate_line_id.`);
      const rateLine = await this.prisma.rateLine.findUniqueOrThrow({ where: { id: item.rateLineId }, include: { contractPeriod: true } });
      const units = item.unitCount; // §4.2 dopuna v1.14 — izvedeno jednom u builderu iz room_config.length

      const result = await this.contractPeriods.reserve(rateLine.contractPeriodId, units, actorId);
      const itemStatus = 'requiresSupplierConfirmation' in result && result.requiresSupplierConfirmation ? 'PENDING_SUPPLIER_CONFIRMATION' : 'CONFIRMED';
      return {
        quoteItemId: item.id,
        itemStatus,
        supplierReference: rateLine.contractPeriodId,
        releaseHandle: () => this.contractPeriods.release(rateLine.contractPeriodId, units, actorId).then(() => undefined),
      };
    }

    // API — pozovi M4 sa jedinstvenim idempotency_key.
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
    if (!product.sourceProvider || !product.sourceExternalId) {
      throw new BadRequestException(`Proizvod ${item.productId} nema povezanog API provajdera.`);
    }
    const occupancy = item.occupancy as { adults: number; children: number };
    const confirmation = await this.integrations.confirmBooking(product.sourceProvider, product.sourceExternalId, {
      stay: { stayFrom: item.stayFrom.toISOString().slice(0, 10), stayTo: item.stayTo.toISOString().slice(0, 10), adults: occupancy.adults, children: occupancy.children },
      guestName: 'TBD', // M5 spec §4.2/§4.3 — ime gosta se vezuje preko BookingItemGuest posle kreiranja stavke, ne pre
      idempotencyKey: `quoteitem-${item.id}`,
    });
    if (confirmation.status === 'FAILED') {
      throw new BadRequestException(`Provajder je odbio rezervaciju za stavku ${item.id} (M5 spec §4 korak 2).`);
    }
    return {
      quoteItemId: item.id,
      itemStatus: confirmation.status,
      supplierReference: confirmation.providerBookingReference,
      releaseHandle: () => this.integrations.cancelBooking(product.sourceProvider!, confirmation.providerBookingReference).then(() => undefined),
    };
  }

  private async releaseAll(outcomes: ItemReservationOutcome[]) {
    for (const outcome of outcomes) {
      if (outcome.releaseHandle) await outcome.releaseHandle();
    }
  }

  private async nextBookingNumber(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.booking.count({ where: { bookingNumber: { startsWith: `TT-${year}-` } } });
      const candidate = generateBookingNumber(year, count + 1 + attempt);
      const exists = await this.prisma.booking.findUnique({ where: { bookingNumber: candidate } });
      if (!exists) return candidate;
    }
    throw new BadRequestException('Nije moguće generisati jedinstven booking_number, pokušajte ponovo.');
  }

  // ==========================================================================
  // Pregled
  // ==========================================================================

  /**
   * M5 spec §6.2 dopuna (avgust 2026, priprema za M8) — vidi common/auth/resolve-caller-identity.ts.
   * M7 dopuna (avgust 2026): za SUBAGENT_CONTACT, identity.ownProfileId je Subagent.id (ne
   * ClientAccount.id) — mora se mapirati preko SubagentStubService na pravi ClientAccount.id
   * pre poređenja sa Quote/Booking.client_account_id, inače ownership provera nikad ne pogađa.
   */
  // Ispravka 28.8.2026 (bezbednosni nalaz, pre lansiranja pregled) — bila je PRIVATNA metoda
  // ove klase, pa je `QuotesService.findOne` napisala SOPSTVENU, nepotpunu verziju (samo GUEST
  // provera, IDOR za SUBAGENT_CONTACT/AI_AGENT) umesto da je deli. Sad je zajednička funkcija
  // (`common/resolve-api-context.ts`) — svaki naredni M5 servis je uvozi, ne prepisuje.
  private async resolveApiContext(
    userId: string,
  ): Promise<{ context: 'INTERNAL_PANEL' | 'B2C' | 'B2B'; ownClientAccountId: string | null; franchiseSubagentId: string | null }> {
    return resolveApiContext(this.prisma, this.subagentStub, userId);
  }

  // M5 spec v1.54 (24.8.2026, na zahtev vlasnika — prava "Lista rezervacija") — v1 skup pravih
  // filtera. Polja koja se odnose na stavku (`stayFrom`/`stayTo`/`productType`/destinacija) se
  // primenjuju preko `items: { some: {...} } }` — "bar jedna stavka ove rezervacije odgovara".
  // NAMERNO primenjeno SAMO za INTERNAL_PANEL kontekst — B2C/B2B/gost kontekst zadržava strogo
  // ownership ponašanje iz poglavlja 6.2, novi parametri se za njih tiho ignorišu (isti princip
  // kao postojeći `clientAccountId` iznad — klijentski parametar nikad ne proširuje tuđ pristup).
  async findAll(
    filters: {
      status?: string[];
      channel?: string;
      clientAccountId?: string;
      paymentStatus?: string[];
      tipNastupanja?: string[];
      buyerName?: string;
      bookingNumber?: string;
      currency?: string;
      createdFrom?: string;
      createdTo?: string;
      stayFrom?: string;
      stayTo?: string;
      returnFrom?: string;
      returnTo?: string;
      productType?: string[];
      productId?: string;
      destinationCity?: string;
      destinationCountry?: string;
      hasTravelGuarantee?: string;
    },
    actor: { userId: string },
  ) {
    const { context, ownClientAccountId, franchiseSubagentId } = await this.resolveApiContext(actor.userId);
    // Gost/B2B kontekst: ownership se NAMEĆE (ownClientAccountId), klijentski
    // clientAccountId parametar se ignoriše — sprečava da gost sam sebi zatraži
    // tuđe rezervacije menjajući query parametar.
    const clientAccountId = context === 'INTERNAL_PANEL' ? filters.clientAccountId : (ownClientAccountId ?? undefined);
    const isInternal = context === 'INTERNAL_PANEL';

    // Multiselect (24.8.2026, na zahtev vlasnika: "u svakom polju filtera gde je to moguce
    // multiselect opciju") — status/uplata/tip nastupanja/tip proizvoda sad prihvataju NIZ
    // vrednosti (`?status=CONFIRMED&status=CANCELLED`), primenjeno preko Prisma `{ in: [...] }`.
    // Ostala polja (tekst/datum/valuta/garancija) NAMERNO ostaju jednostruka — "gde je to
    // moguce" isključuje slobodan tekst i tri-state (ima/nema/svejedno, gde bi izbor oba
    // "ima"+"nema" bio besmislen, isto što i "svejedno").
    const where: Prisma.BookingWhereInput = {
      channel: filters.channel as any,
      clientAccountId,
    };
    if (filters.status && filters.status.length > 0) where.status = { in: filters.status as any };

    if (isInternal) {
      if (filters.paymentStatus && filters.paymentStatus.length > 0) where.paymentStatus = { in: filters.paymentStatus as PaymentStatus[] };
      if (filters.tipNastupanja && filters.tipNastupanja.length > 0) where.tipNastupanja = { in: filters.tipNastupanja as TipNastupanja[] };
      if (filters.buyerName) where.buyerName = { contains: filters.buyerName, mode: 'insensitive' };
      if (filters.bookingNumber) where.bookingNumber = { contains: filters.bookingNumber, mode: 'insensitive' };
      if (filters.currency) where.currency = filters.currency;
      if (filters.createdFrom || filters.createdTo) {
        where.createdAt = {
          ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
          ...(filters.createdTo ? { lte: new Date(`${filters.createdTo}T23:59:59.999Z`) } : {}),
        };
      }
      if (filters.hasTravelGuarantee === 'true') where.travelGuaranteeRegistration = { isNot: null };
      if (filters.hasTravelGuarantee === 'false') where.travelGuaranteeRegistration = { is: null };

      const itemWhere: Prisma.BookingItemWhereInput = {};
      if (filters.stayFrom || filters.stayTo) {
        itemWhere.stayFrom = {
          ...(filters.stayFrom ? { gte: new Date(filters.stayFrom) } : {}),
          ...(filters.stayTo ? { lte: new Date(`${filters.stayTo}T23:59:59.999Z`) } : {}),
        };
      }
      if (filters.returnFrom || filters.returnTo) {
        itemWhere.stayTo = {
          ...(filters.returnFrom ? { gte: new Date(filters.returnFrom) } : {}),
          ...(filters.returnTo ? { lte: new Date(`${filters.returnTo}T23:59:59.999Z`) } : {}),
        };
      }
      if ((filters.productType && filters.productType.length > 0) || filters.destinationCity || filters.destinationCountry) {
        itemWhere.product = {
          ...(filters.productType && filters.productType.length > 0 ? { type: { in: filters.productType as any } } : {}),
          ...(filters.destinationCity ? { destinationCity: filters.destinationCity } : {}),
          ...(filters.destinationCountry ? { destinationCountry: filters.destinationCountry } : {}),
        };
      }
      // Dopuna (26.8.2026, na zahtev vlasnika — "aktivne rezervacije za ovaj hotel" link iz
      // desnog panela, M17 spec "brzi pregled proizvoda") — direktan filter po proizvodu,
      // odvojen od `productType` (koji filtrira po TIPU, ne po konkretnom proizvodu).
      if (filters.productId) itemWhere.productId = filters.productId;
      if (Object.keys(itemWhere).length > 0) where.items = { some: itemWhere };

      // M5 spec §6.6 (31.8.2026) — podrazumevano svi vide sve; sužavanje na sopstveno
      // (vlasništvo ILI zaduženje, §6.5) ide preko DENY na M5/booking/VIEW_ALL (M1 §3.9a).
      // Franšizna granica (§6.6/M7 §2.0.7) važi UVEK za franšizne naloge, nezavisno od
      // VIEW_ALL — franšiza nikad ne vidi tuđu franšizu ili matičnu agenciju ovim putem.
      if (franchiseSubagentId) where.franchiseSubagentId = franchiseSubagentId;
      const hasViewAll = await this.permissions.hasPermission(actor.userId, 'M5', 'booking', 'VIEW_ALL');
      if (!hasViewAll) where.OR = [{ ownerId: actor.userId }, { assignedToId: actor.userId }];
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        items: { include: { product: { select: { destinationCountry: true, destinationCity: true, type: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const { serializeBooking } = await import('./booking-visibility');
    return bookings.map((b) => serializeBooking(b as any, context));
  }

  async findOne(id: string, actorUserId: string) {
    const { context } = await this.resolveApiContext(actorUserId);
    // §4.5 dopuna (1.9.2026) — bez `product`/`guests` odgovor je sadržao samo sirov
    // `productId`, pa se na ekranu rezervacije nije videlo ŠTA je kupljeno ni KO putuje.
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            guests: { select: { id: true, guestFirstName: true, guestLastName: true, guestProfileId: true } },
            // §4.5 dopuna (2.9.2026, na zahtev vlasnika: "kod aranžmana treba da se navede i tip
            // smeštajne jedinice i usluga koja je uplaćena") — tip sobe i usluga (pansion) NISU
            // polja na `BookingItem`, nego žive u ugovoru: `RateLine.boardType` i
            // `ContractPeriod.roomType` (M3). Zato se dohvataju kroz `rateLine`, ne dodaju kao
            // nova kolona — snapshot cene već pokazuje na tačan red cenovnika, pa je to i
            // jedini tačan izvor onoga što je STVARNO ugovoreno i naplaćeno.
            //
            // `rateLineId` je opcion: stavke koje dolaze preko M4 (spoljni API) nemaju red
            // cenovnika, pa za njih ova polja ostaju `null`. To NIJE greška nego stvarno stanje
            // — panel tada ne prikazuje ništa umesto da pogađa (M5 spec §4.5).
            rateLine: {
              select: {
                boardType: true,
                occupancy: true,
                contractPeriod: { select: { roomType: true } },
              },
            },
            product: {
              select: {
                id: true,
                type: true,
                destinationCity: true,
                destinationCountry: true,
                destinationArea: true,
                translations: { select: { languageCode: true, name: true } },
              },
            },
            // §6.7a — vezana doplata/popust NEMA sopstven proizvod (nasleđuje matični, čime
            // nasleđuje i dobavljača), pa bi se bez ovoga prikazivala pod imenom hotela.
            // Naziv nosi M3 `AncillaryService` — „Parking", „Boravišna taksa", „Popust za
            // dugi boravak". Bez naziva doplata je red sa cenom bez značenja.
            ancillaryService: { select: { name: true, kind: true, priceBasis: true } },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException(`Rezervacija ${id} nije pronađena.`);
    await this.assertBookingAccessible(booking, actorUserId);

    // Naziv se razrešava OVDE (M2 §2.2 fallback sr→en), da pozivalac ne mora da poznaje
    // `ProductTranslation` niti da pravi dodatan poziv ka M2 po svakoj stavci.
    const withResolvedProduct = {
      ...booking,
      items: booking.items.map((item) => {
        // `rateLine` se izravnava u tri polja na samoj stavci umesto da se prosledi ugnežden —
        // pozivalac (panel, M7 portal, spoljni integrator) ne treba da poznaje strukturu M3
        // ugovora da bi prikazao "dvokrevetna soba, polupansion".
        const { rateLine, ...itemWithoutRateLine } = item as typeof item & {
          rateLine?: { boardType: string; occupancy: string; contractPeriod: { roomType: string } } | null;
        };
        const contracted = {
          roomType: rateLine?.contractPeriod?.roomType ?? null,
          boardType: rateLine?.boardType ?? null,
          occupancy: rateLine?.occupancy ?? null,
        };
        if (!item.product) return { ...itemWithoutRateLine, ...contracted };
        const { translations, ...product } = item.product;
        return {
          ...itemWithoutRateLine,
          ...contracted,
          product: { ...product, name: resolveTranslation(translations ?? [], 'sr')?.name ?? null },
        };
      }),
    };

    const { serializeBooking } = await import('./booking-visibility');
    return serializeBooking(withResolvedProduct as any, context);
  }

  // ==========================================================================
  // M5 spec §6.5 (31.8.2026) — vlasništvo i zaduženje rezervacije
  // ==========================================================================

  /** Prenos vlasništva — trenutni vlasnik ILI Vlasnik/Direktor bezuslovno, nikad Sales Manager
   * (dozvola TRANSFER_OWNERSHIP se Sales Manageru namerno ne dodeljuje u seed.ts). */
  async transferOwnership(bookingId: string, newOwnerId: string, actor: { userId: string }) {
    const booking = await this.findOneRaw(bookingId);
    const bypass = await this.isVlasnikOrDirektor(actor.userId);
    if (!bypass && booking.ownerId !== actor.userId) {
      throw new ForbiddenException('Samo trenutni vlasnik rezervacije ili Vlasnik/Direktor mogu preneti vlasništvo (M5 spec §6.5).');
    }
    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { ownerId: newOwnerId } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.ownership_transferred',
      resourceType: 'Booking',
      resourceId: bookingId,
      beforeState: { ownerId: booking.ownerId },
      afterState: { ownerId: newOwnerId },
      context: {},
    });
    return updated;
  }

  /** Predlog predaje zaduženja — bilo koji korisnik sa VIEW nad rezervacijom sme da predloži;
   * Vlasnik/Direktor izvršavaju direktno (upisano kao ACCEPTED), ostali čekaju prihvatanje. */
  async proposeHandoff(bookingId: string, toUserId: string, actor: { userId: string }) {
    // findOne primenjuje istu vidljivost kao ostatak M5 (§6.6) — predlagač mora da vidi
    // rezervaciju da bi je uopšte predložio dalje.
    await this.findOne(bookingId, actor.userId);
    const bypass = await this.isVlasnikOrDirektor(actor.userId);
    const now = new Date();

    // Dopuna (31.8.2026) — sprečava dva istovremena PENDING predloga za istu rezervaciju
    // (konkurentski predlozi ka različitim kolegama, samo jedan bi ikad "pobedio" prihvatanjem,
    // drugi bi ostao zbunjujuće visio). Vlasnik/Direktor put ne prolazi kroz ovo — direktno
    // izvršava, ne dodaje PENDING stanje.
    if (!bypass) {
      const existingPending = await this.prisma.bookingHandoffRequest.findFirst({ where: { bookingId, status: 'PENDING' } });
      if (existingPending) {
        throw new BadRequestException('Već postoji predlog predaje na čekanju za ovu rezervaciju — otkažite ga pre novog predloga (M5 spec §6.5).');
      }
    }

    const request = await this.prisma.bookingHandoffRequest.create({
      data: {
        bookingId,
        fromUserId: actor.userId,
        toUserId,
        status: bypass ? 'ACCEPTED' : 'PENDING',
        resolvedAt: bypass ? now : null,
      },
    });

    if (bypass) {
      await this.prisma.booking.update({ where: { id: bookingId }, data: { assignedToId: toUserId } });
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: bypass ? 'booking.handoff_executed' : 'booking.handoff_proposed',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: { toUserId, status: request.status },
      context: { handoffRequestId: request.id },
    });

    return request;
  }

  async acceptHandoff(handoffId: string, actor: { userId: string }) {
    const request = await this.getPendingHandoffOrThrow(handoffId);
    if (request.toUserId !== actor.userId) {
      throw new ForbiddenException('Samo primalac predloga sme da ga prihvati (M5 spec §6.5).');
    }
    const now = new Date();
    const updated = await this.prisma.bookingHandoffRequest.update({
      where: { id: handoffId },
      data: { status: 'ACCEPTED', resolvedAt: now },
    });
    await this.prisma.booking.update({ where: { id: request.bookingId }, data: { assignedToId: request.toUserId } });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.handoff_accepted',
      resourceType: 'Booking',
      resourceId: request.bookingId,
      context: { handoffRequestId: handoffId },
    });
    return updated;
  }

  async declineHandoff(handoffId: string, actor: { userId: string }) {
    const request = await this.getPendingHandoffOrThrow(handoffId);
    if (request.toUserId !== actor.userId) {
      throw new ForbiddenException('Samo primalac predloga sme da ga odbije (M5 spec §6.5).');
    }
    const updated = await this.prisma.bookingHandoffRequest.update({
      where: { id: handoffId },
      data: { status: 'DECLINED', resolvedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.handoff_declined',
      resourceType: 'Booking',
      resourceId: request.bookingId,
      context: { handoffRequestId: handoffId },
    });
    return updated;
  }

  async cancelHandoff(handoffId: string, actor: { userId: string }) {
    const request = await this.getPendingHandoffOrThrow(handoffId);
    const bypass = await this.isVlasnikOrDirektor(actor.userId);
    if (request.fromUserId !== actor.userId && !bypass) {
      throw new ForbiddenException('Samo predlagač (ili Vlasnik/Direktor) sme da otkaže predlog (M5 spec §6.5).');
    }
    const updated = await this.prisma.bookingHandoffRequest.update({
      where: { id: handoffId },
      data: { status: 'CANCELLED', resolvedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.handoff_cancelled',
      resourceType: 'Booking',
      resourceId: request.bookingId,
      context: { handoffRequestId: handoffId },
    });
    return updated;
  }

  /** Dopuna (31.8.2026) — lista predloga predaje za jednu rezervaciju, najnoviji prvi. Koristi
   * istu vidljivost kao findOne (§6.6) da se ne otkrije postojanje tuđe rezervacije. */
  async listHandoffRequests(bookingId: string, actorUserId: string) {
    await this.findOne(bookingId, actorUserId);
    return this.prisma.bookingHandoffRequest.findMany({ where: { bookingId }, orderBy: { createdAt: 'desc' } });
  }

  private async getPendingHandoffOrThrow(handoffId: string) {
    const request = await this.prisma.bookingHandoffRequest.findUnique({ where: { id: handoffId } });
    if (!request) throw new NotFoundException(`Predlog predaje ${handoffId} nije pronađen.`);
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Predlog predaje ${handoffId} više nije na čekanju (status: ${request.status}).`);
    }
    return request;
  }

  /** Sirov, bez-maskiranja pristup Booking-u za interne provere vlasništva (transferOwnership) —
   * ne prolazi kroz serializeBooking jer ne vraća odgovor pozivaocu. */
  private async findOneRaw(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException(`Rezervacija ${id} nije pronađena.`);
    return booking;
  }

  // Dopuna (23.8.2026, na zahtev vlasnika — "citav workflow te rezervacije od pocetka do
  // trenutka kada se gleda status sa datumima, vremenima i ko je radio promenu"). M5 spec §11
  // napomena: promene statusa se NE čuvaju u posebnoj tabeli, koriste se postojeći M1
  // `AuditLogEntry` zapisi (module=M5, resourceType=Booking) — ovde se samo čitaju hronološkim
  // redom i dopunjuju čitljivim imenom aktera (audit zapis čuva samo `actorId`).
  async history(id: string, actorUserId: string) {
    // Ista provera vidljivosti kao findOne — istorija tuđe rezervacije se ne otkriva.
    await this.findOne(id, actorUserId);
    const entries = await this.auditLog.findByResource('Booking', id);
    const actorIds = [...new Set(entries.map((e) => e.actorId).filter((v): v is string => Boolean(v)))];
    const actors = actorIds.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } }) : [];
    const nameById = new Map(actors.map((a) => [a.id, a.fullName]));
    return entries.map((e) => ({
      timestamp: e.timestamp,
      action: e.action,
      actorType: e.actorType,
      actorName: e.actorId ? (nameById.get(e.actorId) ?? e.actorId) : 'sistem',
      context: e.context,
    }));
  }

  // ==========================================================================
  // M5 spec §6.4 — provera duplikata pre otkazivanja
  // ==========================================================================
  private async findDuplicateConflict(item: BookingItem): Promise<{ conflictItem: BookingItem; conflictBookingNumber: string } | null> {
    const guests = await this.prisma.bookingItemGuest.findMany({ where: { bookingItemId: item.id } });
    if (guests.length === 0) return null;

    const candidates = await this.prisma.bookingItem.findMany({
      where: {
        productId: item.productId,
        id: { not: item.id },
        itemStatus: { in: ['CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION'] },
        stayFrom: { lt: item.stayTo },
        stayTo: { gt: item.stayFrom },
      },
      include: { guests: true, booking: true },
    });

    for (const candidate of candidates) {
      for (const g1 of guests) {
        for (const g2 of candidate.guests) {
          if (namesMatch(g1.guestFirstName, g1.guestLastName, g2.guestFirstName, g2.guestLastName)) {
            return { conflictItem: candidate, conflictBookingNumber: candidate.booking.bookingNumber };
          }
        }
      }
    }
    return null;
  }

  // ==========================================================================
  // M5 spec §6 — otkazivanje
  // ==========================================================================
  async cancel(bookingId: string, dto: CancelBookingDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);

    const selected = booking.items.filter(
      (i) => (dto.itemIds ? dto.itemIds.includes(i.id) : true) && i.itemStatus !== 'CANCELLED',
    );
    // §6.7a — vezana doplata/popust pada zajedno sa matičnom stavkom. Bez ovoga bi parking
    // ostao da visi na rezervaciji čija je soba otkazana, i tiho bi ulazio u ukupnu cenu.
    // Dodaju se čak i kad ih pozivalac nije naveo u `itemIds` — to nije proširenje njegovog
    // zahteva nego njegova posledica.
    const selectedIds = new Set(selected.map((i) => i.id));
    const linkedChildren = booking.items.filter(
      (i) => i.parentItemId && selectedIds.has(i.parentItemId) && i.itemStatus !== 'CANCELLED' && !selectedIds.has(i.id),
    );
    const targetItems = [...selected, ...linkedChildren];
    if (targetItems.length === 0) {
      throw new BadRequestException('Nema aktivnih stavki za otkazivanje.');
    }

    // M15 spec §4/§5 — booking_item.cancel_duplicate_check je PROPOSE_THEN_APPROVE: agent sme
    // da pokrene proveru (ispod), ali sam override potvrde upozorenja o duplikatu je uvek
    // ljudska odluka, isti "defense in depth" princip kao ModuleActivationService.update.
    if (dto.confirmDuplicateOverride) {
      const actorUser = await this.prisma.user.findUnique({ where: { id: actor.userId } });
      if (actorUser?.accountType === 'AI_AGENT') {
        throw new ForbiddenException(
          'AI agent ne sme sam da potvrdi otkazivanje uprkos upozorenju o duplikatu (M15 spec §5 — booking_item.cancel_duplicate_check je PROPOSE_THEN_APPROVE).',
        );
      }
    }

    if (!dto.confirmDuplicateOverride) {
      for (const item of targetItems) {
        const conflict = await this.findDuplicateConflict(item);
        if (conflict) {
          return {
            duplicateWarning: true,
            bookingItemId: item.id,
            conflictItemId: conflict.conflictItem.id,
            conflictBookingNumber: conflict.conflictBookingNumber,
            conflictPaymentStatus: (await this.prisma.booking.findUnique({ where: { id: conflict.conflictItem.bookingId } }))?.paymentStatus,
            message: 'Moguć duplikat rezervacije (M5 spec §6.4) — ponovite poziv sa confirm_duplicate_override: true da nastavite.',
          };
        }
      }
    }

    for (const item of targetItems) {
      await this.releaseItemCapacity(item, actor.userId);
      const conflict = dto.confirmDuplicateOverride ? await this.findDuplicateConflict(item) : null;
      const refundPercentage = await this.computeRefundPercentage(item);

      await this.prisma.bookingItem.update({
        where: { id: item.id },
        data: {
          itemStatus: 'CANCELLED',
          cancellationRefundPercentage: refundPercentage,
          duplicateConflictItemId: conflict?.conflictItem.id ?? null,
          duplicateCheckOverriddenBy: conflict ? actor.userId : null,
          duplicateCheckOverriddenAt: conflict ? new Date() : null,
        },
      });

      // §8.8 — priprema DRAFT SupplierChangeNotice (CANCELLATION), samo za CONTRACTED stavke.
      // §8.5 — ako je stavka već na poslatoj (SENT) listi, ta lista se SUPERSEDED + nova DRAFT.
      if (item.sourceType === 'CONTRACTED') {
        await this.changeNotices.prepareDraft(item.id, 'CANCELLATION');
        await this.supplierManifests.supersedeIfOnSentManifest(item.id, actor.userId);
      }
    }

    const remaining = await this.prisma.bookingItem.count({ where: { bookingId, itemStatus: { not: 'CANCELLED' } } });
    const newStatus = remaining === 0 ? 'CANCELLED' : 'MODIFIED';
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: newStatus,
        cancelledAt: newStatus === 'CANCELLED' ? new Date() : null,
        // Do 3.9.2026 otkazivanje NIJE preračunavalo ukupno zaduženje — otkazana stavka je
        // ostajala u `total_price` dok se rezervacija ne izmeni. Ispravljeno u istom prolazu
        // u kom je zbir dobio jedno mesto (`recomputeBookingTotal`, §6.7a).
        totalPrice: await this.recomputeBookingTotal(bookingId),
      },
      include: { items: true },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.cancelled',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: updated,
      context: { itemIds: targetItems.map((i) => i.id) },
    });
    await this.eventBus.emit('M5', 'booking.cancelled', { bookingId, itemIds: targetItems.map((i) => i.id) });

    return updated;
  }

  private async releaseItemCapacity(item: BookingItem, actorId: string) {
    if (item.sourceType === 'CONTRACTED' && item.rateLineId) {
      const rateLine = await this.prisma.rateLine.findUnique({ where: { id: item.rateLineId } });
      // §4.2 dopuna v1.14 — oslobodi TAČAN broj rezervisanih jedinica, ne uvek 1 (bio je bug:
      // višesobna rezervacija je pri otkazivanju oslobađala samo jednu sobu nazad u M3 alotman).
      if (rateLine) await this.contractPeriods.release(rateLine.contractPeriodId, item.unitCount, actorId);
    } else if (item.sourceType === 'API') {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (product?.sourceProvider) {
        await this.integrations.cancelBooking(product.sourceProvider, item.supplierReference);
      }
    }
  }

  private async computeRefundPercentage(item: BookingItem): Promise<number | null> {
    const daysUntilStay = Math.ceil((item.stayFrom.getTime() - Date.now()) / 86_400_000);

    if (!item.rateLineId) {
      // §4.2 dopuna v1.14 — API stavke: isti deterministički algoritam (najspecifičniji
      // daysBeforeStay koji je <= daysUntilStay pobeđuje), primenjen na snimljenu M4 polisu
      // umesto na M3 CancellationRule. Bez snimka (starije stavke pre ove dopune) ostaje null.
      const snapshot = item.cancellationPolicySnapshot as { daysBeforeStay: number; refundPercentage: number }[] | null;
      if (!snapshot || snapshot.length === 0) return null;
      const applicable = snapshot.filter((r) => r.daysBeforeStay <= daysUntilStay).sort((a, b) => b.daysBeforeStay - a.daysBeforeStay)[0];
      return applicable?.refundPercentage ?? 0;
    }

    const rateLine = await this.prisma.rateLine.findUnique({ where: { id: item.rateLineId }, include: { contractPeriod: { include: { cancellationRules: true } } } });
    if (!rateLine) return null;
    // M3 spec §2.5 dopuna v1.12 — cancellationRules sad sadrži i EARLY_DEPARTURE pravila
    // (bez daysBeforeStay); ovaj obračun (otkazivanje pre dolaska) gleda isključivo PRE_ARRIVAL.
    const applicable = rateLine.contractPeriod.cancellationRules
      .filter((r): r is typeof r & { daysBeforeStay: number; refundPercentage: number } => r.ruleType === 'PRE_ARRIVAL' && r.daysBeforeStay !== null && r.daysBeforeStay <= daysUntilStay)
      .sort((a, b) => b.daysBeforeStay - a.daysBeforeStay)[0];
    return applicable?.refundPercentage ?? 0;
  }

  // ==========================================================================
  // M5 spec §6 — izmena (cancel pogođene stavke + nova stavka po novom zahtevu). Dopuna
  // (2.9.2026, na zahtev vlasnika — kartica Aranžman): `dto.productId` opciono menja i USLUGU,
  // ne samo datume/broj gostiju — mora ostati isti `ProductType` kao stavka koja se menja
  // (zamena hotela za drugi hotel je "izmena usluge"; zamena hotela za let nije, to je nova
  // rezervacija). Zajedničko sa `previewModify` ispod — jedina razlika je da preview NIŠTA
  // ne rezerviše/upisuje (koristi se za "proveru cene" pre nego što čovek potvrdi).
  // ==========================================================================
  private async resolveModifiedItem(
    booking: Booking & { items: BookingItem[] },
    dto: ModifyBookingDto,
  ): Promise<{ oldItem: BookingItem; built: BuiltQuoteItemData }> {
    const oldItem = booking.items.find((i) => i.id === dto.bookingItemId);
    if (!oldItem) throw new NotFoundException(`Stavka ${dto.bookingItemId} ne pripada rezervaciji ${booking.id}.`);
    if (oldItem.itemStatus === 'CANCELLED') throw new BadRequestException('Stavka je već otkazana.');

    const targetProductId = dto.productId ?? oldItem.productId;
    if (dto.productId && dto.productId !== oldItem.productId) {
      const [oldProduct, newProduct] = await Promise.all([
        this.prisma.product.findUnique({ where: { id: oldItem.productId } }),
        this.prisma.product.findUnique({ where: { id: dto.productId } }),
      ]);
      if (!newProduct) throw new NotFoundException(`Proizvod ${dto.productId} nije pronađen.`);
      if (oldProduct && newProduct.type !== oldProduct.type) {
        throw new BadRequestException(
          `Nova usluga mora biti istog tipa kao postojeća stavka (${oldProduct.type}) — izmena tipa proizvoda nije "izmena usluge" (M5 spec §6), pravi se nova rezervacija.`,
        );
      }
    }

    // M5 spec §3.0d.6a — build() sad vraća niz (PACKAGE gradi više stavki odjednom); izmena
    // menja TAČNO JEDNU postojeću stavku za jednu novu, pa PACKAGE proizvod ovde nije podržan
    // u ovom prolazu (zamena cele grupe paketa je van obima §6 izmene pojedinačne stavke).
    const builtItems = await this.builder.build({
      productId: targetProductId,
      stayFrom: dto.stayFrom,
      stayTo: dto.stayTo,
      occupancy: dto.occupancy,
    });
    if (builtItems.length !== 1) {
      throw new BadRequestException('Izmena PACKAGE proizvoda (grupni paket) nije podržana kroz izmenu pojedinačne stavke (M5 spec §6).');
    }
    return { oldItem, built: builtItems[0] };
  }

  /** Dopuna (2.9.2026) — "provera cene" PRE nego što se izmena stvarno izvrši: poziva isti
   *  builder kao `modify`, ali ništa ne rezerviše niti upisuje — čist izračun za prikaz. */
  async previewModify(bookingId: string, dto: ModifyBookingDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);
    const { oldItem, built } = await this.resolveModifiedItem(booking, dto);

    return {
      currentPrice: oldItem.finalPrice,
      currentCurrency: oldItem.finalPriceCurrency,
      newPrice: built.finalPrice,
      newCurrency: built.finalPriceCurrency,
      priceDifference: built.finalPrice - oldItem.finalPrice,
    };
  }

  async modify(bookingId: string, dto: ModifyBookingDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);
    const { oldItem, built } = await this.resolveModifiedItem(booking, dto);

    // rezerviši novu stavku PRE oslobađanja stare — izbegava trenutak bez pokrivenog kapaciteta
    // ako oba koraka ciljaju isti period; oslobađanje stare stavke sledi tek posle uspeha.
    const outcome = await this.reserveBuiltItem(built, actor.userId);

    await this.releaseItemCapacity(oldItem, actor.userId);
    await this.prisma.bookingItem.update({ where: { id: oldItem.id }, data: { itemStatus: 'CANCELLED' } });
    if (oldItem.sourceType === 'CONTRACTED') {
      await this.changeNotices.prepareDraft(oldItem.id, 'MODIFICATION');
      await this.supplierManifests.supersedeIfOnSentManifest(oldItem.id, actor.userId);
    }

    const newItem = await this.prisma.bookingItem.create({
      data: {
        bookingId,
        productId: built.productId,
        sourceType: built.sourceType,
        supplierReference: outcome.supplierReference,
        stayFrom: built.stayFrom,
        stayTo: built.stayTo,
        baseCost: built.baseCost,
        baseCostCurrency: built.baseCostCurrency,
        rateLineId: built.rateLineId,
        markupRuleId: built.markupRuleId,
        finalPrice: built.finalPrice,
        finalPriceCurrency: built.finalPriceCurrency,
        itemStatus: outcome.itemStatus,
        unitCount: built.unitCount,
        cancellationPolicySnapshot: built.cancellationPolicySnapshot as any,
        announcedAt: built.sourceType === 'API' ? new Date() : null,
        supplierConfirmedAt: built.sourceType === 'API' ? new Date() : null,
      },
    });

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'MODIFIED', totalPrice: await this.recomputeBookingTotal(bookingId) },
      include: { items: true },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.modified',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: updated,
      context: { oldItemId: oldItem.id, newItemId: newItem.id },
    });
    await this.eventBus.emit('M5', 'booking.modified', { bookingId, oldItemId: oldItem.id, newItemId: newItem.id });

    return updated;
  }

  // ==========================================================================
  // M5 spec §6.7 — dodavanje usluge na postojeću rezervaciju
  // ==========================================================================

  /**
   * §6.7 (vlasnikova odluka 3.9.2026) — dodaje **isključivo interni tim**, i na rezervacijama
   * subagenata. Provera je namerno odvojena od `assertBookingAccessible`: ta metoda odgovara na
   * pitanje „sme li ovaj čovek da vidi/dira ovu rezervaciju", a ova na „sme li se ova RADNJA
   * uopšte izvršiti van internog panela". Subagent svoju rezervaciju vidi i sme da je otkaže,
   * ali uslugu mu dodaje agencija.
   *
   * 403, ne 404: rezervacija mu je već poznata (svoja mu je), pa skrivanje postojanja ovde ne
   * štiti ništa, a poruka „nemate pravo" je jedina koja mu kaže šta da uradi (da pozove agenciju).
   */
  private async assertInternalPanelOnly(actorUserId: string): Promise<void> {
    const { context } = await this.resolveApiContext(actorUserId);
    if (context !== 'INTERNAL_PANEL') {
      throw new ForbiddenException(
        'Uslugu na postojeću rezervaciju dodaje isključivo interni tim agencije (M5 spec §6.7).',
      );
    }
  }

  /** Zajednički deo `addItem`/`previewAddItem` — provere + izgradnja stavke, bez ijedne izmene. */
  private async resolveAddedItem(
    booking: Booking & { items: BookingItem[] },
    dto: AddBookingItemDto,
  ): Promise<BuiltQuoteItemData> {
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Na otkazanu rezervaciju se ne dodaje usluga (M5 spec §6.7).');
    }

    // §6.7 — PACKAGE se odbija iz istog razloga kao kod izmene: paket se sastavlja iz VIŠE
    // stavki odjednom (§3.0d.6a), a ovaj tok upisuje tačno jednu. Bolje 400 nego polovična
    // stavka koju niko posle ne ume da pročita.
    const built = await this.builder.build({
      productId: dto.productId,
      stayFrom: dto.stayFrom,
      stayTo: dto.stayTo,
      occupancy: dto.occupancy,
    });
    if (built.length !== 1) {
      throw new BadRequestException(
        'Dodavanje PACKAGE proizvoda (grupni paket) nije podržano — paket se sastavlja iz više stavki odjednom (M5 spec §6.7/§3.0d.6a).',
      );
    }
    return built[0];
  }

  /** §6.7 korak 2 — „proveri cenu": gradi stavku i vraća razliku, ali NIŠTA ne rezerviše. */
  async previewAddItem(bookingId: string, dto: AddBookingItemDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);
    await this.assertInternalPanelOnly(actor.userId);
    const built = await this.resolveAddedItem(booking, dto);

    const bookingTotalBefore = booking.totalPrice ?? 0;
    return {
      newPrice: built.finalPrice,
      newCurrency: built.finalPriceCurrency,
      bookingTotalBefore,
      bookingTotalAfter: bookingTotalBefore + built.finalPrice,
    };
  }

  /** §6.7 korak 3 — stvarno dodavanje. */
  async addItem(bookingId: string, dto: AddBookingItemDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);
    await this.assertInternalPanelOnly(actor.userId);
    const built = await this.resolveAddedItem(booking, dto);

    // Isti redosled kao kod izmene (§6): kapacitet se PRVO rezerviše kod dobavljača, pa se tek
    // onda upisuje stavka. Obrnuto bi ostavilo stavku u bazi za koju kapacitet nikad nije uzet.
    const outcome = await this.reserveBuiltItem(built, actor.userId);

    const newItem = await this.prisma.bookingItem.create({
      data: {
        bookingId,
        productId: built.productId,
        sourceType: built.sourceType,
        supplierReference: outcome.supplierReference,
        stayFrom: built.stayFrom,
        stayTo: built.stayTo,
        baseCost: built.baseCost,
        baseCostCurrency: built.baseCostCurrency,
        rateLineId: built.rateLineId,
        markupRuleId: built.markupRuleId,
        finalPrice: built.finalPrice,
        finalPriceCurrency: built.finalPriceCurrency,
        itemStatus: outcome.itemStatus,
        unitCount: built.unitCount,
        cancellationPolicySnapshot: built.cancellationPolicySnapshot as any,
        // §8.6 — za API stavku je provajder potvrdio u istom pozivu, pa je i najavljena istog
        // trenutka; CONTRACTED stavka ostaje NENAJAVLJENA i time je hvata `prepareForBooking`.
        announcedAt: built.sourceType === 'API' ? new Date() : null,
        supplierConfirmedAt: built.sourceType === 'API' ? new Date() : null,
      },
    });

    // §6.7a — obavezne doplate se povlače ODMAH uz novu stavku, pre nego što se izračuna ukupno.
    await this.attachMandatoryAncillaries(newItem.id);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'MODIFIED', totalPrice: await this.recomputeBookingTotal(bookingId) },
      include: { items: true },
    });

    // §6.7 odluka vlasnika — NOVA najava, ne dopuna postojeće. `prepareForBooking` hvata samo
    // NENAJAVLJENE CONTRACTED stavke i grupiše ih po dobavljaču (§8.4), pa dodata stavka dobija
    // svoj nacrt a već poslate najave se ne diraju — mehanizam je to već radio tačno, ovde se
    // samo pokreće.
    if (built.sourceType === 'CONTRACTED') {
      await this.supplierManifests.prepareForBooking(bookingId, actor.userId);
    }

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.item_added',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: updated,
      context: { newItemId: newItem.id, productId: built.productId },
    });
    await this.eventBus.emit('M5', 'booking.item_added', { bookingId, newItemId: newItem.id });

    return updated;
  }

  // ==========================================================================
  // M5 spec §6.7a — doplate i popusti kao VEZANE stavke
  // ==========================================================================

  /**
   * Ukupno zaduženje rezervacije. **`ON_SITE` stavke se izuzimaju** (§6.7a): agencija ih nikad
   * ne naplati ni ne isplati, pa bi u ukupnoj ceni bile lažno zaduženje i pokvarile svaki
   * finansijski izveštaj (M10/M13). One se prikazuju odvojeno, sa oznakom „plaća se na licu
   * mesta" — vide se, ali se ne sabiraju.
   *
   * Jedno mesto za ceo modul: ranije je isti `aggregate` stajao prepisan u `modify`, `cancel`
   * i `addItem`, pa bi izuzimanje `ON_SITE` moralo da se doda na tri mesta i tiho bi se
   * razišlo pri prvom preskoku.
   */
  private async recomputeBookingTotal(bookingId: string): Promise<number> {
    const totalPrice = await this.prisma.bookingItem.aggregate({
      where: { bookingId, itemStatus: { not: 'CANCELLED' }, payable: 'AGENCY' },
      _sum: { finalPrice: true },
    });
    return totalPrice._sum.finalPrice ?? 0;
  }

  /** Kontekst obračuna doplate iz matične stavke — noći, sobe, osobe. */
  private ancillaryContextFor(parent: BookingItem & { guests?: { id: string }[] }, quantity: number) {
    const nights = Math.max(
      Math.round((parent.stayTo.getTime() - parent.stayFrom.getTime()) / 86_400_000),
      1,
    );
    // POZNATO OGRANIČENJE (§6.7a): `BookingItem` ne nosi podelu odrasli/deca — `QuoteItem` je
    // ima (`occupancy`), `BookingItem` nikad nije ni imao. Zato se svi putnici ovde broje kao
    // odrasli, pa granice `max_children`/`child_max_age` (M3 v1.13) ovde ne mogu da odbiju
    // ništa. Nije prećutano: upisano u spec i u backlog.
    const persons = Math.max(parent.guests?.length ?? 0, 1);
    return {
      nights,
      adults: persons,
      children: 0,
      rooms: Math.max(parent.unitCount ?? 1, 1),
      // Nabavna cena JEDNE noći matične stavke — osnova za PERCENTAGE_OF_NIGHTLY_RATE.
      nightlyRate: Math.round(parent.baseCost / nights),
      quantity,
    };
  }

  /** Doplate/popusti ugovoreni za period matične stavke, sa već izračunatom cenom za ovu stavku. */
  async listAncillariesForItem(bookingId: string, itemId: string, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: { include: { guests: true } } } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);

    const parent = booking.items.find((i) => i.id === itemId);
    if (!parent) throw new NotFoundException(`Stavka ${itemId} ne pripada rezervaciji ${bookingId}.`);

    // Doplate su ugovorna kategorija (M3 §2.6) — API stavka nema ugovorni period, pa ni spisak.
    // Prazna lista, ne greška: to je tačno stanje, ne kvar.
    if (!parent.rateLineId) return [];
    const rateLine = await this.prisma.rateLine.findUnique({
      where: { id: parent.rateLineId },
      include: { contractPeriod: { include: { ancillaryServices: true } } },
    });
    if (!rateLine) return [];

    const alreadyAdded = new Set(
      booking.items.filter((i) => i.parentItemId === parent.id && i.itemStatus !== 'CANCELLED').map((i) => i.ancillaryServiceId),
    );
    const ctx = this.ancillaryContextFor(parent, 1);

    return rateLine.contractPeriod.ancillaryServices.map((svc) => ({
      id: svc.id,
      name: svc.name,
      kind: svc.kind,
      priceBasis: svc.priceBasis,
      payable: svc.payable,
      isMandatory: svc.isMandatory,
      isRefundable: svc.isRefundable,
      maxQuantity: svc.maxQuantity,
      notes: svc.notes,
      /** Iznos za TAČNO ovu stavku (njene noći, sobe i putnike) — ne gola cena iz cenovnika. */
      amount: signedAncillaryAmount(svc as unknown as AncillaryServiceLike, ctx),
      currency: parent.finalPriceCurrency,
      alreadyAdded: alreadyAdded.has(svc.id),
      /** Razlog zašto se ne može dodati (sastav gostiju), ili `null`. */
      blockedReason: checkAncillaryOccupancy(svc as unknown as AncillaryServiceLike, { adults: ctx.adults, children: ctx.children }),
    }));
  }

  /**
   * Upisuje doplatu/popust kao vezanu stavku. Zajedničko za ručno dodavanje (agent bira) i za
   * automatsko povlačenje obaveznih (`attachMandatoryAncillaries`) — ista pravila cene i istog
   * oblika zapis, da se ta dva puta ne raziđu.
   */
  private async createAncillaryItem(
    parent: BookingItem & { guests?: { id: string }[] },
    svc: {
      id: string;
      name: string;
      kind: 'SURCHARGE' | 'DISCOUNT';
      payable: 'AGENCY' | 'ON_SITE';
      maxQuantity: number | null;
    } & Record<string, unknown>,
    quantity: number,
  ) {
    const ctx = this.ancillaryContextFor(parent, quantity);
    const baseCost = signedAncillaryAmount(svc as unknown as AncillaryServiceLike, ctx);

    // Marža na doplatu: ista kao na matičnoj stavci (doplata je deo iste prodaje, ne zaseban
    // posao) — zato se pravilo ne razrešava iznova nego se čita ono koje je stavka već dobila.
    //
    // DVA IZUZETKA, oba namerna:
    //  - `ON_SITE`: gost plaća dobavljaču direktno, agencija tu ništa ne prodaje — marža nema
    //    na šta da se primeni.
    //  - `DISCOUNT`: popust prolazi gostu 1:1. Primena procenta na negativan iznos bi tiho
    //    umanjila popust koji je gost dobio, a fiksni deo marže bi mu ga još i naplatio.
    //    (Odluka agenta uz §6.7a, zabeležena kao takva — ako agencija sme da zadrži deo
    //    dobavljačevog popusta, menja se ovde, na jednom mestu.)
    const rule =
      svc.payable === 'ON_SITE' || svc.kind === 'DISCOUNT' || !parent.markupRuleId
        ? null
        : await this.prisma.markupRule.findUnique({ where: { id: parent.markupRuleId } });
    const finalPrice = rule ? applyMarkup(baseCost, rule) : baseCost;

    return this.prisma.bookingItem.create({
      data: {
        bookingId: parent.bookingId,
        // Doplata nema sopstven proizvod ni cenovnu liniju — nasleđuje matičnu stavku, čime
        // nasleđuje i dobavljača (za vaučer i najavu, §6.7a).
        productId: parent.productId,
        sourceType: parent.sourceType,
        supplierReference: parent.supplierReference,
        stayFrom: parent.stayFrom,
        stayTo: parent.stayTo,
        baseCost,
        baseCostCurrency: parent.baseCostCurrency,
        rateLineId: null,
        markupRuleId: parent.markupRuleId,
        finalPrice,
        finalPriceCurrency: parent.finalPriceCurrency,
        itemStatus: parent.itemStatus,
        unitCount: quantity,
        parentItemId: parent.id,
        ancillaryServiceId: svc.id,
        payable: svc.payable,
        // Doplata ide na najavu zajedno sa matičnom stavkom (isti dobavljač, isti period) —
        // sopstvena najava za „parking" bez konteksta sobe nikome ne znači ništa.
        announcedAt: parent.announcedAt,
        supplierConfirmedAt: parent.supplierConfirmedAt,
      },
    });
  }

  /**
   * §6.7a — OBAVEZNE doplate se povlače automatski uz stavku, agent bira samo opcione.
   *
   * Razlog je iskustvo, ne udobnost: obavezna doplata koju treba ručno dodati pre ili kasnije
   * nekome ispadne iz cene, a to se otkriva tek na licu mesta, kad je već reklamacija.
   */
  private async attachMandatoryAncillaries(parentId: string): Promise<number> {
    const parent = await this.prisma.bookingItem.findUnique({ where: { id: parentId }, include: { guests: true } });
    if (!parent?.rateLineId) return 0;
    const rateLine = await this.prisma.rateLine.findUnique({
      where: { id: parent.rateLineId },
      include: { contractPeriod: { include: { ancillaryServices: { where: { isMandatory: true } } } } },
    });
    if (!rateLine) return 0;

    let added = 0;
    for (const svc of rateLine.contractPeriod.ancillaryServices) {
      // Sastav gostiju koji ne staje u granice obavezne doplate se PRESKAČE, ne ruši dodavanje
      // stavke: bolje stavka bez doplate koju čovek vidi i doda ručno, nego odbijena rezervacija
      // zbog cenovnika dobavljača.
      if (checkAncillaryOccupancy(svc as unknown as AncillaryServiceLike, { adults: Math.max(parent.guests.length, 1), children: 0 })) continue;
      await this.createAncillaryItem(parent, svc as any, 1);
      added++;
    }
    return added;
  }

  /** §6.7a — agent dodaje OPCIONU doplatu/popust na postojeću stavku. */
  async addAncillaryToItem(bookingId: string, itemId: string, dto: AddAncillaryItemDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: { include: { guests: true } } } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);
    await this.assertInternalPanelOnly(actor.userId);
    if (booking.status === 'CANCELLED') throw new BadRequestException('Na otkazanu rezervaciju se ne dodaje doplata (M5 spec §6.7a).');

    const parent = booking.items.find((i) => i.id === itemId);
    if (!parent) throw new NotFoundException(`Stavka ${itemId} ne pripada rezervaciji ${bookingId}.`);
    if (parent.itemStatus === 'CANCELLED') throw new BadRequestException('Stavka je otkazana — doplata se ne dodaje na otkazanu stavku.');
    if (parent.parentItemId) throw new BadRequestException('Doplata se dodaje na uslugu, ne na drugu doplatu (M5 spec §6.7a).');

    const svc = await this.prisma.ancillaryService.findUnique({ where: { id: dto.ancillaryServiceId } });
    if (!svc) throw new NotFoundException(`Doplata ${dto.ancillaryServiceId} nije pronađena.`);

    const quantity = dto.quantity ?? 1;
    if (svc.maxQuantity != null && quantity > svc.maxQuantity) {
      throw new BadRequestException(`Najviše ${svc.maxQuantity} kom. za „${svc.name}" (M3 spec §2.6).`);
    }
    const blocked = checkAncillaryOccupancy(svc as unknown as AncillaryServiceLike, {
      adults: Math.max(parent.guests.length, 1),
      children: 0,
    });
    if (blocked) throw new BadRequestException(blocked);

    const item = await this.createAncillaryItem(parent, svc as any, quantity);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { totalPrice: await this.recomputeBookingTotal(bookingId) },
      include: { items: true },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.ancillary_added',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: updated,
      context: { parentItemId: parent.id, ancillaryServiceId: svc.id, itemId: item.id, payable: svc.payable },
    });
    await this.eventBus.emit('M5', 'booking.ancillary_added', { bookingId, itemId: item.id, parentItemId: parent.id });

    return updated;
  }

  /**
   * §6.7b — ručno uneta usluga: usluga koje nema ni u ugovoru (M3) ni kod provajdera (M4).
   *
   * **Jednokratna usluga je `DRAFT` proizvod, ne poseban tip zapisa.** Vlasnikova odluka posle
   * preporuke: proizvod u katalogu je vidljiv pretrazi, javnom sajtu (M8) i B2B portalu (M7) —
   * ali samo dok je `ACTIVE`. `DRAFT` proizvod postoji, ima dobavljača i cenu, i ne pojavljuje
   * se nigde osim na svojoj rezervaciji. Kvačica „sačuvaj u katalog" ga prevodi u `ACTIVE`.
   * Time nema drugog, paralelnog mehanizma za istu stvar — što je greška zbog koje ovaj
   * repozitorijum uopšte ima pravila (`22-ANALIZA-PRIMETRAVEL-NALAZI.md`).
   *
   * **Cena se prima od klijenta**, jedini takav slučaj u M5 — ručna usluga po definiciji nema
   * cenovnik iz kog bi se izvela. Zato se traže OBE cene: marža je proverljiva razlika, ne
   * tvrdnja, i `markup_rule_id` ostaje prazan umesto da pokazuje na pravilo koje nije
   * učestvovalo u ceni.
   */
  async addManualItem(bookingId: string, dto: AddManualItemDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);
    await this.assertInternalPanelOnly(actor.userId);
    if (booking.status === 'CANCELLED') throw new BadRequestException('Na otkazanu rezervaciju se ne dodaje usluga (M5 spec §6.7).');

    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException(`Dobavljač ${dto.supplierId} nije pronađen.`);
    if (dto.finalPrice < dto.baseCost) {
      // Nije zabrana prodaje ispod nabavne cene nego zaštita od zamenjenih polja: agent koji
      // greškom upiše izlaznu u polje nabavne pravi negativnu maržu na celoj rezervaciji.
      throw new BadRequestException('Izlazna cena ne sme biti manja od nabavne — proverite da polja nisu zamenjena (M5 spec §6.7b).');
    }
    const stayFrom = new Date(dto.stayFrom);
    const stayTo = new Date(dto.stayTo);
    if (stayTo <= stayFrom) throw new BadRequestException('Datum završetka mora biti posle datuma početka.');

    const product = await this.prisma.product.create({
      data: {
        type: dto.productType,
        sourceType: 'MANUAL',
        supplierId: supplier.id,
        destinationCountry: dto.destinationCountry,
        destinationCity: dto.destinationCity,
        // §6.7b — jednokratna usluga NE ulazi u katalog: `DRAFT` je ne prikazuje ni pretrazi
        // (`GET /search` traži ACTIVE), ni sajtu, ni B2B portalu.
        status: dto.saveToCatalog ? 'ACTIVE' : 'DRAFT',
        visibleChannels: dto.saveToCatalog ? ['B2C_SITE', 'B2B_PORTAL'] : [],
        createdBy: actor.userId,
        translations: {
          // `description`/`slug` su obavezni u M2 modelu; ručna usluga često nema opis, pa se
          // upisuje prazan string, ne izmišljen tekst. Slug nosi vreme unosa da dva istoimena
          // jednokratna unosa („Transfer kombijem") ne bi imala isti — jedinstvenost je
          // svojstvo sluga, i ne sme zavisiti od toga koliko je agent bio maštovit.
          create: [
            {
              languageCode: 'sr' as const,
              name: dto.name,
              description: dto.description ?? '',
              slug: `${dto.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'usluga'}-${Date.now().toString(36)}`,
            },
          ],
        },
      },
    });

    const item = await this.prisma.bookingItem.create({
      data: {
        bookingId,
        productId: product.id,
        sourceType: 'MANUAL',
        // Nema reference dobavljača jer nema ni rezervacije kod njega — usluga je dogovorena
        // van sistema. Prazan string bi lagao da referenca postoji.
        supplierReference: '',
        stayFrom,
        stayTo,
        baseCost: dto.baseCost,
        baseCostCurrency: dto.currency,
        rateLineId: null,
        markupRuleId: null,
        finalPrice: dto.finalPrice,
        finalPriceCurrency: dto.currency,
        itemStatus: 'CONFIRMED',
        unitCount: 1,
      },
    });

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'MODIFIED', totalPrice: await this.recomputeBookingTotal(bookingId) },
      include: { items: true },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.manual_item_added',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: updated,
      context: {
        itemId: item.id,
        productId: product.id,
        supplierId: supplier.id,
        savedToCatalog: Boolean(dto.saveToCatalog),
        baseCost: dto.baseCost,
        finalPrice: dto.finalPrice,
      },
    });
    await this.eventBus.emit('M5', 'booking.manual_item_added', { bookingId, itemId: item.id, productId: product.id });

    return updated;
  }

  /** Ukupno što gost plaća NA LICU MESTA — ne ulazi u `total_price`, ali se mora videti (§6.7a). */
  async onSiteTotal(bookingId: string): Promise<number> {
    const agg = await this.prisma.bookingItem.aggregate({
      where: { bookingId, itemStatus: { not: 'CANCELLED' }, payable: 'ON_SITE' },
      _sum: { finalPrice: true },
    });
    return agg._sum.finalPrice ?? 0;
  }

  private async reserveBuiltItem(
    built: BuiltQuoteItemData,
    actorId: string,
  ): Promise<{ itemStatus: 'CONFIRMED' | 'PENDING_SUPPLIER_CONFIRMATION'; supplierReference: string }> {
    if (built.sourceType === 'CONTRACTED') {
      if (!built.rateLineId) throw new BadRequestException('Nova stavka (CONTRACTED) nema rate_line_id.');
      const rateLine = await this.prisma.rateLine.findUniqueOrThrow({ where: { id: built.rateLineId } });
      const result = await this.contractPeriods.reserve(rateLine.contractPeriodId, built.unitCount, actorId);
      const pending = 'requiresSupplierConfirmation' in result && result.requiresSupplierConfirmation;
      return { itemStatus: pending ? 'PENDING_SUPPLIER_CONFIRMATION' : 'CONFIRMED', supplierReference: rateLine.contractPeriodId };
    }
    const product = await this.prisma.product.findUniqueOrThrow({ where: { id: built.productId } });
    const confirmation = await this.integrations.confirmBooking(product.sourceProvider!, product.sourceExternalId!, {
      stay: { stayFrom: built.stayFrom.toISOString().slice(0, 10), stayTo: built.stayTo.toISOString().slice(0, 10), adults: (built.occupancy as any).adults, children: (built.occupancy as any).children },
      guestName: 'TBD',
      idempotencyKey: `modify-${built.productId}-${Date.now()}`,
    });
    if (confirmation.status === 'FAILED') throw new BadRequestException('Provajder je odbio novu rezervaciju za izmenjenu stavku.');
    return { itemStatus: confirmation.status, supplierReference: confirmation.providerBookingReference };
  }

  // ==========================================================================
  // M5 spec §5/§6 — payment-status + generisanje vaučera
  // ==========================================================================
  async updatePaymentStatus(bookingId: string, paymentStatus: PaymentStatus, actor: { userId: string }) {
    const before = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!before) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(before, actor.userId);

    const updated = await this.prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.payment_status_changed',
      resourceType: 'Booking',
      resourceId: bookingId,
      beforeState: { paymentStatus: before.paymentStatus },
      afterState: { paymentStatus: updated.paymentStatus },
      context: {},
    });

    if (paymentStatus === 'PAID') {
      await this.maybeIssueVoucher(bookingId);
    }
    return this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { items: true } });
  }

  // §6 — generisanje vaučera kad su uslovi ispunjeni (PAID, ili izuzetak §6.3).
  async maybeIssueVoucher(bookingId: string): Promise<void> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.voucherUrl) return;
    if (booking.status !== 'CONFIRMED') return;

    let eligible = booking.paymentStatus === 'PAID';
    if (!eligible) {
      eligible = await this.compliance.isActiveSubagentWithinCreditLimit(booking.clientAccountId);
    }
    if (!eligible) return;

    if (booking.tipNastupanja === 'ORGANIZATOR') {
      const hasContract = await this.clientContractStub.hasGeneratedContract(bookingId);
      if (!hasContract) return; // M20 ClientContract još ne postoji GENERATED — vaučer čeka (§6 dopuna)
    }

    await this.issueVoucher(bookingId);
  }

  private async issueVoucher(bookingId: string) {
    await this.prisma.booking.update({ where: { id: bookingId }, data: { voucherUrl: buildVoucherUrl(bookingId) } });
  }

  // M5 spec §6/§4.1/§11 — POST /bookings/:id/voucher/override, zahteva M5/voucher/OVERRIDE_ISSUE
  // (sprovodi se na nivou kontrolera preko @RequirePermission — Vlasnik/Direktor ISKLJUČIVO).
  async voucherOverride(bookingId: string, reason: string, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    await this.assertBookingAccessible(booking, actor.userId);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        voucherUrl: buildVoucherUrl(bookingId),
        voucherOverrideApprovedBy: actor.userId,
        voucherOverrideReason: reason,
        voucherOverrideAt: new Date(),
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking.voucher_override_issued',
      resourceType: 'Booking',
      resourceId: bookingId,
      afterState: { voucherUrl: updated.voucherUrl, reason },
      context: {},
    });

    return updated;
  }

  // ==========================================================================
  // M5 spec §6 dopuna (2.9.2026, na zahtev vlasnika: "podaci predstavnika treba automatski da
  // se pojave na vaučeru") — javan, neautentifikovan sadržaj vaučera. Isti obrazac kao M23
  // PublicKnowledgeController: ODVOJEN kontroler bez guard-a, ovaj servisni metod fizički
  // učitava/vraća SAMO ono što gost sme da vidi (§6.2 maskiranje — nikad supplier_reference/
  // base_cost/markup_rule_id/rate_line_id), i SAMO kad je vaučer stvarno izdat (voucher_url
  // postavljen) — rezervacija pre toga nema šta da pokaže kao "dokument".
  // ==========================================================================
/**
   * §6 dopuna (3.9.2026, vlasnikova odluka) — **jedan vaučer po DOBAVLJAČU je podrazumevani**,
   * pojedinačni po usluzi je opcija. Kad rezervacija ima više stavki istog dobavljača (soba +
   * parking + spa u istom hotelu), one idu na JEDAN dokument: tri odvojena vaučera za istu
   * porodicu na istoj recepciji su tri prilike za grešku.
   *
   * **Ime dobavljača se NE prikazuje — i to nije previd.** §6.2 zabranjuje da bilo koje polje iz
   * M3 `Supplier`/`Contract` (do kog se dolazi preko `product_id`) završi u sadržaju koji vidi
   * gost. Vaučer se zato GRUPIŠE po dobavljaču, ali se ZOVE po uslugama koje nosi („Hotel Avala
   * Resort, Budva") — a to je ionako ono što gost predaje na recepciji. Hotel je proizvod;
   * dobavljač može biti veletrgovac čije ime gost ne treba ni da vidi.
   *
   * Iz istog razloga u adresi stoji **redni broj grupe unutar ove rezervacije** (1, 2, 3…), ne
   * `supplier_id`: UUID dobavljača bi bio isti kroz sve rezervacije i time upotrebljiv za
   * povezivanje, iako sam po sebi ne kaže ime.
   *
   * `groupIndex` vraća samo tu grupu; `itemId` samo tu jednu uslugu (opcija „pojedinačni
   * vaučer"). Bez oba — sve grupe.
   */
  async getVoucherContent(bookingId: string, opts: { groupIndex?: number; itemId?: string } = {}) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: {
          where: { itemStatus: { not: 'CANCELLED' } },
          orderBy: { stayFrom: 'asc' },
          include: {
            guests: { select: { guestFirstName: true, guestLastName: true } },
            ancillaryService: { select: { name: true, kind: true } },
            product: {
              select: {
                type: true,
                destinationCity: true,
                destinationCountry: true,
                destinationArea: true,
                sourceProvider: true,
                supplierId: true,
                sourceContract: { select: { supplierId: true } },
                translations: { select: { languageCode: true, name: true } },
              },
            },
          },
        },
      },
    });
    if (!booking || !booking.voucherUrl) throw new NotFoundException('Vaučer nije pronađen ili još nije izdat.');

    const guideIds = [...new Set(booking.items.map((i) => i.assignedGuideId).filter((id): id is string => Boolean(id)))];
    const guides = guideIds.length > 0 ? await this.prisma.user.findMany({ where: { id: { in: guideIds } }, select: { id: true, fullName: true, phone: true, email: true } }) : [];
    const guidesById = new Map(guides.map((g) => [g.id, g]));

    const toVoucherItem = (item: (typeof booking.items)[number]) => {
      const guide = item.assignedGuideId ? guidesById.get(item.assignedGuideId) : undefined;
      return {
        // Vezana doplata/popust (§6.7a) nema sopstven proizvod — nosi naziv iz ugovora, inače bi
        // se na vaučeru pojavila kao još jedan red sa imenom hotela.
        productName: item.ancillaryService?.name ?? resolveTranslation(item.product?.translations ?? [], 'sr')?.name ?? null,
        productType: item.product?.type ?? null,
        destinationCity: item.product?.destinationCity ?? null,
        destinationArea: item.product?.destinationArea ?? null,
        destinationCountry: item.product?.destinationCountry ?? null,
        stayFrom: item.stayFrom,
        stayTo: item.stayTo,
        unitCount: item.unitCount,
        // §6.7a — gost mora unapred da zna šta ga na licu mesta čeka; prećutan trošak je
        // najbrži put do reklamacije.
        payable: item.payable,
        price: item.finalPrice,
        currency: item.finalPriceCurrency,
        guests: item.guests.map((g) => ({ guestFirstName: g.guestFirstName, guestLastName: g.guestLastName })),
        representative: guide ? { fullName: guide.fullName, phone: guide.phone, email: guide.email } : null,
      };
    };

    // Ključ grupisanja je dobavljač — ugovoreni ga ima kroz ugovor, ručno unet direktno
    // (§6.7b), a stavka preko API veze nema `Supplier` zapis pa je grupiše provajder.
    // Vezana doplata ide u grupu SVOJE matične stavke, ma šta njen proizvod govorio.
    const byId = new Map(booking.items.map((i) => [i.id, i]));
    const groupKeyOf = (item: (typeof booking.items)[number]): string => {
      const root = item.parentItemId ? (byId.get(item.parentItemId) ?? item) : item;
      return (
        root.product?.sourceContract?.supplierId ??
        root.product?.supplierId ??
        (root.product?.sourceProvider ? `provider:${root.product.sourceProvider}` : `item:${root.id}`)
      );
    };

    const order: string[] = [];
    const buckets = new Map<string, typeof booking.items>();
    for (const item of booking.items) {
      const key = groupKeyOf(item);
      if (!buckets.has(key)) {
        buckets.set(key, [] as unknown as typeof booking.items);
        order.push(key);
      }
      buckets.get(key)!.push(item);
    }

    let groups = order.map((key, idx) => {
      const items = buckets.get(key)!;
      // Naziv vaučera su USLUGE koje nosi, nikad ime dobavljača (§6.2) — a to je ionako ono što
      // gost prepoznaje: „Hotel Avala Resort, Budva".
      const label = [...new Set(items.filter((i) => !i.parentItemId).map((i) => resolveTranslation(i.product?.translations ?? [], 'sr')?.name).filter(Boolean))].join(', ');
      return {
        index: idx + 1,
        label: label || 'Usluge',
        items: items.map(toVoucherItem),
        onSiteTotal: items.filter((i) => i.payable === 'ON_SITE').reduce((sum, i) => sum + i.finalPrice, 0),
      };
    });

    if (opts.groupIndex != null) {
      groups = groups.filter((g) => g.index === opts.groupIndex);
      if (groups.length === 0) throw new NotFoundException('Traženi vaučer ne postoji na ovoj rezervaciji.');
    }
    if (opts.itemId) {
      groups = groups
        .map((g) => ({ ...g, items: g.items.filter((_, i) => buckets.get(order[g.index - 1])![i].id === opts.itemId) }))
        .filter((g) => g.items.length > 0);
      if (groups.length === 0) throw new NotFoundException('Tražena usluga ne postoji na ovoj rezervaciji.');
    }

    return {
      bookingNumber: booking.bookingNumber,
      buyerName: booking.buyerName,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      /** Ukupno što gost plaća na licu mesta (§6.7a) — nije uključeno u `totalPrice`. */
      onSiteTotal: groups.reduce((sum, g) => sum + g.onSiteTotal, 0),
      groups,
    };
  }

  // ==========================================================================
  // M5 spec §4.2 dopuna (M9 spec §4) — dodela vodiča na terenu za stavku rezervacije.
  // ==========================================================================
  async assignGuide(bookingItemId: string, assignedGuideId: string | null, actor: { userId: string }) {
    const before = await this.prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
    if (!before) throw new NotFoundException(`Stavka rezervacije ${bookingItemId} nije pronađena.`);
    const parentBooking = await this.prisma.booking.findUniqueOrThrow({ where: { id: before.bookingId } });
    await this.assertBookingAccessible(parentBooking, actor.userId);

    const updated = await this.prisma.bookingItem.update({
      where: { id: bookingItemId },
      data: { assignedGuideId },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking_item.guide_assigned',
      resourceType: 'BookingItem',
      resourceId: bookingItemId,
      beforeState: { assignedGuideId: before.assignedGuideId },
      afterState: { assignedGuideId: updated.assignedGuideId },
      context: {},
    });

    return updated;
  }

  // ==========================================================================
  // M5 spec §4.3 dopuna (2.9.2026, na zahtev vlasnika: "u tabu Putnici treba omogućiti
  // dodavanje i brisanje putnika i vršiti izmene... ovo nema veze sa profilom putnika") —
  // CRUD nad `BookingItemGuest` na već potvrđenoj stavci. Menja SAMO ime/prezime na M5 stub
  // polju, nikad `guestProfileId`/M6 `GuestProfile` — isti IDOR obrazac kao `assignGuide`
  // iznad (učitaj stavku → učitaj roditeljsku rezervaciju → assertBookingAccessible).
  // ==========================================================================
  async addGuest(bookingItemId: string, dto: { guestFirstName: string; guestLastName: string }, actor: { userId: string }) {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
    if (!item) throw new NotFoundException(`Stavka rezervacije ${bookingItemId} nije pronađena.`);
    const parentBooking = await this.prisma.booking.findUniqueOrThrow({ where: { id: item.bookingId } });
    await this.assertBookingAccessible(parentBooking, actor.userId);

    const duplicate = await this.prisma.bookingItemGuest.findFirst({
      where: { bookingItemId, guestFirstName: dto.guestFirstName, guestLastName: dto.guestLastName },
    });
    if (duplicate) throw new BadRequestException('Putnik sa tim imenom i prezimenom već postoji na ovoj stavci.');

    const guest = await this.prisma.bookingItemGuest.create({
      data: { bookingItemId, guestFirstName: dto.guestFirstName, guestLastName: dto.guestLastName },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking_item_guest.added',
      resourceType: 'BookingItemGuest',
      resourceId: guest.id,
      afterState: guest,
      context: { bookingItemId },
    });

    return guest;
  }

  async updateGuest(bookingItemId: string, guestId: string, dto: { guestFirstName: string; guestLastName: string }, actor: { userId: string }) {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
    if (!item) throw new NotFoundException(`Stavka rezervacije ${bookingItemId} nije pronađena.`);
    const parentBooking = await this.prisma.booking.findUniqueOrThrow({ where: { id: item.bookingId } });
    await this.assertBookingAccessible(parentBooking, actor.userId);

    const before = await this.prisma.bookingItemGuest.findUnique({ where: { id: guestId } });
    if (!before || before.bookingItemId !== bookingItemId) throw new NotFoundException(`Putnik ${guestId} ne pripada stavci ${bookingItemId}.`);

    const updated = await this.prisma.bookingItemGuest.update({
      where: { id: guestId },
      data: { guestFirstName: dto.guestFirstName, guestLastName: dto.guestLastName },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking_item_guest.updated',
      resourceType: 'BookingItemGuest',
      resourceId: guestId,
      beforeState: { guestFirstName: before.guestFirstName, guestLastName: before.guestLastName },
      afterState: { guestFirstName: updated.guestFirstName, guestLastName: updated.guestLastName },
      context: { bookingItemId },
    });

    return updated;
  }

  async removeGuest(bookingItemId: string, guestId: string, actor: { userId: string }) {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
    if (!item) throw new NotFoundException(`Stavka rezervacije ${bookingItemId} nije pronađena.`);
    const parentBooking = await this.prisma.booking.findUniqueOrThrow({ where: { id: item.bookingId } });
    await this.assertBookingAccessible(parentBooking, actor.userId);

    const before = await this.prisma.bookingItemGuest.findUnique({ where: { id: guestId } });
    if (!before || before.bookingItemId !== bookingItemId) throw new NotFoundException(`Putnik ${guestId} ne pripada stavci ${bookingItemId}.`);

    await this.prisma.bookingItemGuest.delete({ where: { id: guestId } });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M5',
      action: 'booking_item_guest.removed',
      resourceType: 'BookingItemGuest',
      resourceId: guestId,
      beforeState: before,
      context: { bookingItemId },
    });

    return { removed: true };
  }

  // ==========================================================================
  // M5 spec §7 — kalendar rezervacija
  // ==========================================================================
  // Isti filter-skup kao `findAll` (poglavlje iznad), BEZ datumskih opsega (stayFrom/stayTo/
  // returnFrom/returnTo) — u kalendaru taj opseg već zadaje SAM prikaz (mesec/nedelja/dan koji
  // se gleda), drugi, zaseban datumski filter bi bio konfuzan/redundantan. Dopuna 27.8.2026, na
  // zahtev vlasnika: "Dodati filtere koji postoje u Listi rezervacija" u novi Google Calendar
  // stil kalendara (M17 spec).
  private buildCalendarItemWhere(filters: CalendarFilters): Prisma.BookingItemWhereInput {
    const bookingWhere: Prisma.BookingWhereInput = {};
    if (filters.status && filters.status.length > 0) bookingWhere.status = { in: filters.status as any };
    if (filters.paymentStatus && filters.paymentStatus.length > 0) bookingWhere.paymentStatus = { in: filters.paymentStatus as PaymentStatus[] };
    if (filters.tipNastupanja && filters.tipNastupanja.length > 0) bookingWhere.tipNastupanja = { in: filters.tipNastupanja as TipNastupanja[] };
    if (filters.buyerName) bookingWhere.buyerName = { contains: filters.buyerName, mode: 'insensitive' };
    if (filters.bookingNumber) bookingWhere.bookingNumber = { contains: filters.bookingNumber, mode: 'insensitive' };
    if (filters.currency) bookingWhere.currency = filters.currency;
    if (filters.createdFrom || filters.createdTo) {
      bookingWhere.createdAt = {
        ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}),
        ...(filters.createdTo ? { lte: new Date(`${filters.createdTo}T23:59:59.999Z`) } : {}),
      };
    }
    if (filters.hasTravelGuarantee === 'true') bookingWhere.travelGuaranteeRegistration = { isNot: null };
    if (filters.hasTravelGuarantee === 'false') bookingWhere.travelGuaranteeRegistration = { is: null };

    const itemWhere: Prisma.BookingItemWhereInput = {};
    if ((filters.productType && filters.productType.length > 0) || filters.destinationCity || filters.destinationCountry) {
      itemWhere.product = {
        ...(filters.productType && filters.productType.length > 0 ? { type: { in: filters.productType as any } } : {}),
        ...(filters.destinationCity ? { destinationCity: filters.destinationCity } : {}),
        ...(filters.destinationCountry ? { destinationCountry: filters.destinationCountry } : {}),
      };
    }
    if (filters.productId) itemWhere.productId = filters.productId;
    if (Object.keys(bookingWhere).length > 0) itemWhere.booking = bookingWhere;
    return itemWhere;
  }

  async calendarSummary(from: Date, to: Date, filters: CalendarFilters = {}) {
    const items = await this.prisma.bookingItem.findMany({
      where: {
        itemStatus: { in: ['CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION'] },
        stayFrom: { lte: to },
        stayTo: { gte: from },
        ...this.buildCalendarItemWhere(filters),
      },
      select: { stayFrom: true, stayTo: true },
    });

    const perDay = new Map<string, { arrivals: number; departures: number; stayovers: number; singleDay: number }>();
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      perDay.set(toMidnightUtc(d).toISOString().slice(0, 10), { arrivals: 0, departures: 0, stayovers: 0, singleDay: 0 });
    }

    for (const item of items) {
      const from_ = toMidnightUtc(item.stayFrom);
      const to_ = toMidnightUtc(item.stayTo);
      for (const [key, bucket] of perDay) {
        const day = new Date(`${key}T00:00:00.000Z`);
        if (day < from_ || day > to_) continue;
        const category = classifyByDay(from_, to_, day);
        if (category === 'ARRIVAL') bucket.arrivals++;
        else if (category === 'DEPARTURE') bucket.departures++;
        else if (category === 'STAYOVER') bucket.stayovers++;
        else bucket.singleDay++;
      }
    }

    return Array.from(perDay.entries()).map(([date, b]) => ({
      date,
      arrivalsCount: b.arrivals,
      departuresCount: b.departures,
      stayoversCount: b.stayovers,
      singleDayCount: b.singleDay,
    }));
  }

  async calendarDay(date: Date, filters: CalendarFilters = {}) {
    const day = toMidnightUtc(date);
    const items = await this.prisma.bookingItem.findMany({
      where: {
        itemStatus: { in: ['CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION'] },
        stayFrom: { lte: day },
        stayTo: { gte: day },
        ...this.buildCalendarItemWhere(filters),
      },
      include: { booking: true, guests: true, product: { select: { type: true, destinationCity: true, destinationCountry: true } } },
    });

    const groups: Record<'ARRIVAL' | 'DEPARTURE' | 'STAYOVER' | 'SINGLE_DAY', unknown[]> = {
      ARRIVAL: [],
      DEPARTURE: [],
      STAYOVER: [],
      SINGLE_DAY: [],
    };
    for (const item of items) {
      const category = classifyByDay(toMidnightUtc(item.stayFrom), toMidnightUtc(item.stayTo), day);
      // M17 spec dopuna (27.8.2026, "sumarni izveštaj u desnom panelu klikom na dan") — polja
      // ispod (status rezervacije/uplate, destinacija, tip proizvoda, broj soba, cena) NISU bila
      // potrebna dok je dnevni detalj samo ispisivao listu — sad ih agregira klijent u sažetak.
      groups[category].push({
        bookingItemId: item.id,
        bookingId: item.bookingId,
        bookingNumber: item.booking.bookingNumber,
        productId: item.productId,
        status: item.itemStatus,
        guests: item.guests.map((g) => `${g.guestFirstName} ${g.guestLastName}`),
        bookingStatus: item.booking.status,
        paymentStatus: item.booking.paymentStatus,
        productType: item.product.type,
        destinationCity: item.product.destinationCity,
        destinationCountry: item.product.destinationCountry,
        unitCount: item.unitCount,
        finalPrice: item.finalPrice,
        finalPriceCurrency: item.finalPriceCurrency,
      });
    }
    return groups;
  }
}
