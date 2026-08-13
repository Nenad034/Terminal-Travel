import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingItem, PaymentStatus, Prisma, QuoteItem, TipNastupanja } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { ContractPeriodsService } from '../../m3-ugovaranje-alotmani/contract-periods/contract-periods.service';
import { IntegrationsService } from '../../m4-integracije-api/integrations.service';
import { QuoteItemBuilderService } from '../quotes/quote-item-builder.service';
import { ComplianceStubsService } from '../common/compliance-stubs.service';
import { ClientContractStubService } from '../common/client-contract-stub.service';
import { generateBookingNumber } from '../common/booking-number';
import { classifyByDay, toMidnightUtc } from '../common/calendar-classification';
import { namesMatch } from '../common/fuzzy-match';
import { isSelfServiceChannel, resolveTipNastupanja, M5Channel as M5ChannelType } from '../common/tip-nastupanja';
import { ConfirmQuoteDto } from './dto/confirm-quote.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ModifyBookingDto } from './dto/modify-booking.dto';
import { SupplierChangeNoticesService } from '../supplier-manifests/supplier-change-notices.service';
import { SupplierManifestsService } from '../supplier-manifests/supplier-manifests.service';
import { resolveCallerIdentity } from '../../../common/auth/resolve-caller-identity';
import { SubagentStubService } from '../common/subagent-stub.service';

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
  ) {}

  // ==========================================================================
  // M5 spec §4 — Quote → Booking
  // ==========================================================================
  async confirmQuote(quoteId: string, dto: ConfirmQuoteDto, actor: { userId: string }) {
    let quote = await this.prisma.quote.findUnique({ where: { id: quoteId }, include: { items: true } });
    if (!quote) throw new NotFoundException(`Ponuda ${quoteId} nije pronađena.`);

    // §6.2 obrazac dopune — gost sme da potvrdi isključivo sopstvenu Ponudu (client_account_id
    // je već primorano na sopstveni nalog pri POST /quotes, ova provera zatvara pokušaj
    // potvrde TUĐE ponude pogađanjem/enumeracijom quoteId).
    const { context, ownClientAccountId } = await this.resolveApiContext(actor.userId);
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
    const rebuilt = await Promise.all(
      quote.items.map((item) =>
        this.builder.build({
          productId: item.productId,
          stayFrom: item.stayFrom.toISOString(),
          stayTo: item.stayTo.toISOString(),
          occupancy: item.occupancy as any,
          rateLineId: item.rateLineId,
        }),
      ),
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
  private async resolveApiContext(userId: string): Promise<{ context: 'INTERNAL_PANEL' | 'B2C' | 'B2B'; ownClientAccountId: string | null }> {
    const identity = await resolveCallerIdentity(this.prisma, userId);
    if (identity.accountType === 'GUEST') return { context: 'B2C', ownClientAccountId: identity.ownProfileId };
    if (identity.accountType === 'SUBAGENT_CONTACT') {
      const clientAccountId = identity.ownProfileId
        ? await this.subagentStub.resolveClientAccountIdForSubagentContact(identity.ownProfileId)
        : null;
      return { context: 'B2B', ownClientAccountId: clientAccountId };
    }
    // M16 spec §2/§4 dopuna (avgust 2026) — MCP klijent (User.accountType=AI_AGENT) dobija isto
    // B2C maskiranje kao gost (sakriva supplier polja, §6.2), ali sopstveni ClientAccount
    // predstavlja CEO spoljnog partnera (pool svih njegovih rezervacija), ne pojedinačnog
    // putnika — isti obrazac kao B2B iznad, samo bez SubagentStub posredovanja jer
    // User.linked_profile_id VEĆ jeste direktno ClientAccount.id za AI_AGENT (M16 registracija).
    if (identity.accountType === 'AI_AGENT') return { context: 'B2C', ownClientAccountId: identity.ownProfileId };
    return { context: 'INTERNAL_PANEL', ownClientAccountId: null };
  }

  async findAll(filters: { status?: string; channel?: string; clientAccountId?: string }, actor: { userId: string }) {
    const { context, ownClientAccountId } = await this.resolveApiContext(actor.userId);
    // Gost/B2B kontekst: ownership se NAMEĆE (ownClientAccountId), klijentski
    // clientAccountId parametar se ignoriše — sprečava da gost sam sebi zatraži
    // tuđe rezervacije menjajući query parametar.
    const clientAccountId = context === 'INTERNAL_PANEL' ? filters.clientAccountId : (ownClientAccountId ?? undefined);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: filters.status as any,
        channel: filters.channel as any,
        clientAccountId,
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const { serializeBooking } = await import('./booking-visibility');
    return bookings.map((b) => serializeBooking(b as any, context));
  }

  async findOne(id: string, actorUserId: string) {
    const { context, ownClientAccountId } = await this.resolveApiContext(actorUserId);
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${id} nije pronađena.`);
    if (context !== 'INTERNAL_PANEL' && booking.clientAccountId !== ownClientAccountId) {
      // Ne otkrivati postojanje tuđe rezervacije — ista "ne otkrivati" filozofija
      // kao M1 requestPasswordReset (ne kaže da li email postoji).
      throw new NotFoundException(`Rezervacija ${id} nije pronađena.`);
    }
    const { serializeBooking } = await import('./booking-visibility');
    return serializeBooking(booking as any, context);
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

    const targetItems = booking.items.filter(
      (i) => (dto.itemIds ? dto.itemIds.includes(i.id) : true) && i.itemStatus !== 'CANCELLED',
    );
    if (targetItems.length === 0) {
      throw new BadRequestException('Nema aktivnih stavki za otkazivanje.');
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
      data: { status: newStatus, cancelledAt: newStatus === 'CANCELLED' ? new Date() : null },
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
    const applicable = rateLine.contractPeriod.cancellationRules
      .filter((r) => r.daysBeforeStay <= daysUntilStay)
      .sort((a, b) => b.daysBeforeStay - a.daysBeforeStay)[0];
    return applicable?.refundPercentage ?? 0;
  }

  // ==========================================================================
  // M5 spec §6 — izmena (cancel pogođene stavke + nova stavka po novom zahtevu)
  // ==========================================================================
  async modify(bookingId: string, dto: ModifyBookingDto, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);
    const oldItem = booking.items.find((i) => i.id === dto.bookingItemId);
    if (!oldItem) throw new NotFoundException(`Stavka ${dto.bookingItemId} ne pripada rezervaciji ${bookingId}.`);
    if (oldItem.itemStatus === 'CANCELLED') throw new BadRequestException('Stavka je već otkazana.');

    const built = await this.builder.build({
      productId: oldItem.productId,
      stayFrom: dto.stayFrom,
      stayTo: dto.stayTo,
      occupancy: dto.occupancy,
    });

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

    const totalPrice = await this.prisma.bookingItem.aggregate({
      where: { bookingId, itemStatus: { not: 'CANCELLED' } },
      _sum: { finalPrice: true },
    });

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'MODIFIED', totalPrice: totalPrice._sum.finalPrice ?? 0 },
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

  private async reserveBuiltItem(
    built: Awaited<ReturnType<QuoteItemBuilderService['build']>>,
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
    // Format vaučera je van obima ove specifikacije (§13) — referenca/URL šablon je dovoljan
    // da izlazni kriterijum (§12) bude proverljiv ("vaučer se generiše").
    await this.prisma.booking.update({ where: { id: bookingId }, data: { voucherUrl: `https://vouchers.internal.terminal-travel/${bookingId}.pdf` } });
  }

  // M5 spec §6/§4.1/§11 — POST /bookings/:id/voucher/override, zahteva M5/voucher/OVERRIDE_ISSUE
  // (sprovodi se na nivou kontrolera preko @RequirePermission — Vlasnik/Direktor ISKLJUČIVO).
  async voucherOverride(bookingId: string, reason: string, actor: { userId: string }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException(`Rezervacija ${bookingId} nije pronađena.`);

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        voucherUrl: `https://vouchers.internal.terminal-travel/${bookingId}.pdf`,
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
  // M5 spec §7 — kalendar rezervacija
  // ==========================================================================
  async calendarSummary(from: Date, to: Date) {
    const items = await this.prisma.bookingItem.findMany({
      where: {
        itemStatus: { in: ['CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION'] },
        stayFrom: { lte: to },
        stayTo: { gte: from },
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

  async calendarDay(date: Date) {
    const day = toMidnightUtc(date);
    const items = await this.prisma.bookingItem.findMany({
      where: {
        itemStatus: { in: ['CONFIRMED', 'PENDING_SUPPLIER_CONFIRMATION'] },
        stayFrom: { lte: day },
        stayTo: { gte: day },
      },
      include: { booking: true, guests: true },
    });

    const groups: Record<'ARRIVAL' | 'DEPARTURE' | 'STAYOVER' | 'SINGLE_DAY', unknown[]> = {
      ARRIVAL: [],
      DEPARTURE: [],
      STAYOVER: [],
      SINGLE_DAY: [],
    };
    for (const item of items) {
      const category = classifyByDay(toMidnightUtc(item.stayFrom), toMidnightUtc(item.stayTo), day);
      groups[category].push({
        bookingItemId: item.id,
        bookingId: item.bookingId,
        bookingNumber: item.booking.bookingNumber,
        productId: item.productId,
        status: item.itemStatus,
        guests: item.guests.map((g) => `${g.guestFirstName} ${g.guestLastName}`),
      });
    }
    return groups;
  }
}
