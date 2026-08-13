import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FiscalDocumentType, VatCalculationBasis } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import type { FiscalizationGatewayAdapter } from '../adapters/fiscalization-gateway-adapter.interface';
import { FISCALIZATION_GATEWAY_ADAPTER } from '../adapters/fiscalization-gateway.token';
import { EventBusService } from '../../../common/events/event-bus.service';

const VAT_RATE_PERCENT = 20; // opšta stopa PDV, M10 spec §4.2/§4.3

// M10 spec §6 — dvostepen tok: DRAFT (AI sme) → SUBMIT (isključivo čovek, poglavlje 7 Master dokumenta).
@Injectable()
export class FiscalDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly exchangeRates: ExchangeRatesService,
    @Inject(FISCALIZATION_GATEWAY_ADAPTER) private readonly gateway: FiscalizationGatewayAdapter,
    private readonly eventBus: EventBusService,
  ) {}

  // §6.0 — poziva se i ručno (POST /fiscal-documents/draft) i automatski po booking.confirmed.
  // Idempotentno: ako nacrt/dokument za ovu Booking već postoji (i nije STORNIRANO), vraća ga.
  async prepareDraft(bookingId: string) {
    const existing = await this.prisma.fiscalDocument.findFirst({
      where: { bookingId, status: { not: 'STORNIRANO' } },
    });
    if (existing) return existing;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { items: true } });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} nije pronađen.`);

    // §2 — izbor tipa dokumenta iz buyer_type, sistem ga bira, ne agent.
    const documentType: FiscalDocumentType = booking.buyerType === 'PRAVNO_LICE' ? 'SEF_EFAKTURA' : 'ESIR_RACUN';
    // §4.4 — vat_calculation_basis iz tip_nastupanja.
    const vatCalculationBasis: VatCalculationBasis = booking.tipNastupanja === 'ORGANIZATOR' ? 'MARZA' : 'PROVIZIJA';

    // §4.2/§4.3 — osnovica (marža ili provizija) = prodajna cena − nabavna cena stavki.
    const baseCostSum = booking.items.reduce((sum, item) => sum + item.baseCost, 0);
    const grossBasis = booking.totalPrice - baseCostSum;
    const vatAmount = Math.round((grossBasis * VAT_RATE_PERCENT) / (100 + VAT_RATE_PERCENT));

    const { amountRsd, exchangeRateSnapshotId } = await this.convertToRsd(booking.totalPrice, booking.currency, new Date());

    const document = await this.prisma.fiscalDocument.create({
      data: {
        bookingId: booking.id,
        documentType,
        status: 'DRAFT',
        vatCalculationBasis,
        amountOriginal: booking.totalPrice,
        currencyOriginal: booking.currency,
        amountRsd,
        vatRate: VAT_RATE_PERCENT,
        vatAmount,
        exchangeRateSnapshotId,
        buyerNameSnapshot: booking.buyerName,
        buyerTaxIdSnapshot: booking.buyerTaxId,
      },
    });

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M10',
      action: 'fiscal_document.draft_created',
      resourceType: 'FiscalDocument',
      resourceId: document.id,
      afterState: document,
    });

    return document;
  }

  // §5.1a — KNJIZNO_ODOBRENJE nacrt, bez booking_id, iz M7 CommissionRebate.
  async prepareCreditNoteDraft(dto: CreateCreditNoteDto) {
    const { amountRsd, exchangeRateSnapshotId } = await this.convertToRsd(dto.amount, dto.currency, new Date());

    return this.prisma.fiscalDocument.create({
      data: {
        bookingId: null,
        documentType: 'KNJIZNO_ODOBRENJE',
        status: 'DRAFT',
        vatCalculationBasis: null,
        amountOriginal: dto.amount,
        currencyOriginal: dto.currency,
        amountRsd,
        vatRate: 0,
        vatAmount: 0,
        exchangeRateSnapshotId,
        // §5.1a — subagent nema buyer_name na ovom nivou (nema Booking); M7 FiscalDocumentStubService
        // (apps/api/src/modules/m7-b2b-subagenti/commission/fiscal-document-stub.service.ts) popunjava
        // stvarni naziv firme preko M6 ClientAccount.company_name pre poziva ovog metoda. Prazan string
        // ostaje fallback za pozive van tog toka (npr. ručno preko Swagger UI-ja) gde naziv nije poznat.
        buyerNameSnapshot: dto.buyerNameSnapshot ?? '',
        relatedSubagentId: dto.relatedSubagentId,
        creditedRebateId: dto.creditedRebateId,
      },
    });
  }

  // M14 spec §3.2 — priprema DRAFT storno nacrt (za razliku od storno() ispod, koji odmah šalje
  // ka fiskalnom gateway-u): traži poslednji SUBMITTED/ISSUED dokument vezan za booking, kreira
  // NOVI FiscalDocument u statusu DRAFT sa stornoOfDocumentId popunjenim, iste vrednosti kao
  // original. Idempotentno (kao prepareDraft) — ako DRAFT storno nacrt za taj original već postoji,
  // vraća ga. Ako booking nema poslat dokument za storniranje, vraća null (informativno, ne baca
  // grešku — pozivalac, M14 event subscriber, odlučuje šta dalje).
  async prepareStornoDraftForBooking(bookingId: string) {
    const original = await this.prisma.fiscalDocument.findFirst({
      where: { bookingId, status: { in: ['SUBMITTED', 'ISSUED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!original) return null;

    const existingDraft = await this.prisma.fiscalDocument.findFirst({
      where: { stornoOfDocumentId: original.id, status: 'DRAFT' },
    });
    if (existingDraft) return existingDraft;

    const document = await this.prisma.fiscalDocument.create({
      data: {
        bookingId: original.bookingId,
        documentType: original.documentType,
        status: 'DRAFT',
        vatCalculationBasis: original.vatCalculationBasis,
        stornoOfDocumentId: original.id,
        amountOriginal: original.amountOriginal,
        currencyOriginal: original.currencyOriginal,
        amountRsd: original.amountRsd,
        vatRate: original.vatRate,
        vatAmount: original.vatAmount,
        exchangeRateSnapshotId: original.exchangeRateSnapshotId,
        buyerNameSnapshot: original.buyerNameSnapshot,
        buyerTaxIdSnapshot: original.buyerTaxIdSnapshot,
      },
    });

    await this.auditLog.write({
      actorType: 'SYSTEM',
      module: 'M10',
      action: 'fiscal_document.storno_draft_created',
      resourceType: 'FiscalDocument',
      resourceId: document.id,
      afterState: document,
    });

    return document;
  }

  async findOne(id: string) {
    const document = await this.prisma.fiscalDocument.findUnique({ where: { id } });
    if (!document) throw new NotFoundException(`FiscalDocument ${id} nije pronađen.`);
    return document;
  }

  // §6 korak 2 — isključivo čovek, kontroler ovo štiti dozvolom M10/fiscal-document/SUBMIT.
  async submit(id: string, actor: { userId: string }) {
    const document = await this.findOne(id);
    if (document.status !== 'DRAFT') {
      throw new BadRequestException(`FiscalDocument ${id} nije u statusu DRAFT (status: ${document.status}).`);
    }

    // §3 — pre SUBMIT-a, preračunaj amount_rsd po kursu na dan uplate ako je uplata (koja
    // dovodi do pune naplate) u međuvremenu stigla; ako nije, ostaje kurs sa pripreme nacrta.
    const recalculated = await this.recalculateForSubmit(document);

    const result = await this.gateway.submitDocument({
      documentType: document.documentType,
      amountRsd: recalculated.amountRsd,
      vatAmount: document.vatAmount,
      buyerName: document.buyerNameSnapshot,
      buyerTaxId: document.buyerTaxIdSnapshot,
    });

    const now = new Date();
    // §5.1/§6 — samo SEF_EFAKTURA/KNJIZNO_ODOBRENJE (oba B2B, subagent je pravno lice) imaju
    // koncept prihvatanja; ESIR_RACUN je N/A (poglavlje 5.1).
    const isSefStyle = document.documentType !== 'ESIR_RACUN';
    const buyerAcceptanceDeadline = isSefStyle ? new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) : null;
    // M14 spec §3.2 — DRAFT pripremljen preko prepareStornoDraftForBooking (stornoOfDocumentId
    // popunjen) završava slanje u statusu STORNIRANO, ne SUBMITTED — isti krajnji status kao
    // odmah-pošalji storno() ispod, samo dvostepen (DRAFT → ljudska SUBMIT potvrda).
    const isStornoDraft = !!document.stornoOfDocumentId;

    const updated = await this.prisma.fiscalDocument.update({
      where: { id },
      data: {
        status: isStornoDraft ? 'STORNIRANO' : 'SUBMITTED',
        externalReference: result.externalReference,
        xmlUrl: result.xmlUrl,
        pdfUrl: result.pdfUrl,
        amountRsd: recalculated.amountRsd,
        exchangeRateSnapshotId: recalculated.exchangeRateSnapshotId,
        submittedBy: actor.userId,
        submittedAt: now,
        issuedAt: now,
        buyerAcceptanceStatus: isSefStyle ? 'PENDING' : 'N_A',
        buyerAcceptanceDeadline,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: isStornoDraft ? 'fiscal_document.storno' : 'fiscal_document.submitted',
      resourceType: 'FiscalDocument',
      resourceId: id,
      beforeState: document,
      afterState: updated,
    });

    // §5.1a — kad je ovo KNJIZNO_ODOBRENJE (M7 CommissionRebate primena), M7 rabat prelazi u
    // APPLIED tek SAD, kad je knjiženje stvarno poslato — ne pri odobrenju (M7 spec §3.2).
    // M10 NE uvozi M7 direktno (M7 CommissionModule već uvozi M10 FiscalDocumentsModule za
    // korak "kreiranje nacrta pri odobrenju" — obrnut DI smer bi napravio kružnu zavisnost
    // modula), zato ide preko Event Bus-a (isti LISTEN/NOTIFY obrazac kao M5 booking.confirmed)
    // — M7EventSubscribersService sluša ovaj događaj i zove CommissionRebatesService.markApplied.
    if (updated.documentType === 'KNJIZNO_ODOBRENJE' && updated.creditedRebateId) {
      await this.eventBus.emit('M10', 'credit_note.submitted', { creditedRebateId: updated.creditedRebateId, fiscalDocumentId: updated.id });
    }

    return updated;
  }

  // §6.1 — storno: kreira NOVI dokument istog tipa, referencira original, ide DRAFT → SUBMITTED
  // → STORNIRANO. Original se nikad ne menja/briše.
  async storno(id: string, actor: { userId: string }) {
    const original = await this.findOne(id);
    if (original.status !== 'SUBMITTED' && original.status !== 'ISSUED') {
      throw new BadRequestException(
        `Storno je moguć samo nad poslatim dokumentom (status SUBMITTED/ISSUED), trenutni status: ${original.status}.`,
      );
    }

    const result = await this.gateway.submitDocument({
      documentType: original.documentType,
      amountRsd: original.amountRsd,
      vatAmount: original.vatAmount,
      buyerName: original.buyerNameSnapshot,
      buyerTaxId: original.buyerTaxIdSnapshot,
    });

    const now = new Date();
    const stornoDocument = await this.prisma.fiscalDocument.create({
      data: {
        bookingId: original.bookingId,
        documentType: original.documentType,
        status: 'STORNIRANO',
        vatCalculationBasis: original.vatCalculationBasis,
        stornoOfDocumentId: original.id,
        externalReference: result.externalReference,
        xmlUrl: result.xmlUrl,
        pdfUrl: result.pdfUrl,
        amountOriginal: original.amountOriginal,
        currencyOriginal: original.currencyOriginal,
        amountRsd: original.amountRsd,
        vatRate: original.vatRate,
        vatAmount: original.vatAmount,
        exchangeRateSnapshotId: original.exchangeRateSnapshotId,
        buyerNameSnapshot: original.buyerNameSnapshot,
        buyerTaxIdSnapshot: original.buyerTaxIdSnapshot,
        buyerAcceptanceStatus: original.documentType === 'ESIR_RACUN' ? 'N_A' : 'PENDING',
        buyerAcceptanceDeadline: original.documentType === 'ESIR_RACUN' ? null : new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
        submittedBy: actor.userId,
        submittedAt: now,
        issuedAt: now,
      },
    });

    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId: actor.userId,
      module: 'M10',
      action: 'fiscal_document.storno',
      resourceType: 'FiscalDocument',
      resourceId: stornoDocument.id,
      beforeState: original,
      afterState: stornoDocument,
    });

    return stornoDocument;
  }

  // §6.2 — DRAFT dokument stariji od 24h bez slanja; poziva se periodično (@Cron u alarms servisu).
  async findStaleDrafts(olderThanHours = 24) {
    const threshold = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    return this.prisma.fiscalDocument.findMany({ where: { status: 'DRAFT', createdAt: { lt: threshold } } });
  }

  private async convertToRsd(
    amount: number,
    currency: string,
    onDate: Date,
  ): Promise<{ amountRsd: number; exchangeRateSnapshotId: string | null }> {
    if (currency === 'RSD') return { amountRsd: amount, exchangeRateSnapshotId: null };
    const snapshot = await this.exchangeRates.findForCurrencyOnOrBefore(currency, onDate);
    const amountRsd = Math.round(amount * Number(snapshot.nbsMiddleRate));
    return { amountRsd, exchangeRateSnapshotId: snapshot.id };
  }

  // §3 — pre SUBMIT, ako je booking u međuvremenu u potpunosti naplaćen, preračunaj po kursu
  // na dan uplate koja je dovela do pune naplate; inače zadrži kurs sa pripreme nacrta.
  private async recalculateForSubmit(document: {
    id: string;
    bookingId: string | null;
    amountOriginal: number;
    currencyOriginal: string;
    amountRsd: number;
    exchangeRateSnapshotId: string | null;
  }) {
    if (!document.bookingId) return { amountRsd: document.amountRsd, exchangeRateSnapshotId: document.exchangeRateSnapshotId };

    const booking = await this.prisma.booking.findUnique({ where: { id: document.bookingId } });
    if (!booking || booking.paymentStatus !== 'PAID') {
      return { amountRsd: document.amountRsd, exchangeRateSnapshotId: document.exchangeRateSnapshotId };
    }

    const payments = await this.prisma.payment.findMany({
      where: { bookingId: document.bookingId, status: 'RECEIVED' },
      orderBy: { receivedAt: 'asc' },
    });

    let cumulative = 0;
    let completingPaymentDate: Date | null = null;
    for (const payment of payments) {
      cumulative += payment.amount;
      if (cumulative >= booking.totalPrice) {
        completingPaymentDate = payment.receivedAt ?? new Date();
        break;
      }
    }
    if (!completingPaymentDate) return { amountRsd: document.amountRsd, exchangeRateSnapshotId: document.exchangeRateSnapshotId };

    return this.convertToRsd(document.amountOriginal, document.currencyOriginal, completingPaymentDate);
  }
}
