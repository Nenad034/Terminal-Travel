import { Injectable, Logger } from '@nestjs/common';
import { BookingItem, Booking, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductsService } from '../../m2-katalog-proizvoda/products/products.service';
import { ContractsService } from '../../m3-ugovaranje-alotmani/contracts/contracts.service';
import { SuppliersService } from '../../m3-ugovaranje-alotmani/suppliers/suppliers.service';
import { ClientAccountsService } from '../../m6-crm/client-accounts/client-accounts.service';
import { SubagentsService } from '../../m7-b2b-subagenti/subagents/subagents.service';
import { PaymentsService } from '../../m10-finansije/payments/payments.service';
import { ExchangeRatesService } from '../../m10-finansije/exchange-rates/exchange-rates.service';
import { ContentService } from '../../m12-marketing/content/content.service';
import { FactSyncCache } from './fact-sync-cache';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * M13 spec §1.1/§2 — M13 gradi sopstvenu izvedenu, obnovljivu projekciju (FactBooking/FactPayment)
 * umesto da čita direktno iz baza drugih modula. Ovaj servis je JEDINO mesto koje zna kako se ta
 * projekcija gradi — koristi ga i M13EventSubscribersService (skoro-realno-vreme, po pojedinačnom
 * M5 događaju) i ReconciliationService (noćni posao, puna provera/rekonstrukcija). Cross-modul
 * podaci se povlače kroz postojeće servise M2/M3/M6/M7/M10 (in-process DI, isti obrazac kao
 * M6/M7/M10 event subscriberi); za sâm M5 Booking/BookingItem/BookingItemGuest koristi se direktan
 * Prisma pristup preko weak reference — isti ustaljeni obrazac koji već koriste M6/M7/M10/M11
 * event subscriberi (npr. M6EventSubscribersService.recalculateLoyalty) jer M5 ne izlaže poseban
 * "interni" servisni sloj za sirovo čitanje bez ownership/vidljivost filtera.
 */
@Injectable()
export class FactSyncService {
  private readonly logger = new Logger(FactSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly contracts: ContractsService,
    private readonly suppliers: SuppliersService,
    private readonly clientAccounts: ClientAccountsService,
    private readonly subagents: SubagentsService,
    private readonly payments: PaymentsService,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly content: ContentService,
  ) {}

  // ==========================================================================
  // FactBooking
  // ==========================================================================

  /**
   * Ponovo izgrađuje i upisuje FactBooking red za JEDNU M5 BookingItem stavku (idempotentno).
   *
   * `cache` (5.9.2026, dok. 39 nalaz 2.3) je opcion i koristi ga SAMO rekonsilijacija, koja u
   * jednom prolazu prolazi kroz hiljade stavki nad istim proizvodima/dobavljačima. Pojedinačan
   * poziv iz event subscriber-a ga NE prosleđuje — tamo je reč o jednoj stavci, pa keš ne bi
   * doneo ništa, a nosio bi rizik da se čita zastarelo stanje.
   */
  async syncBookingItem(bookingItemId: string, cache?: FactSyncCache): Promise<void> {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: bookingItemId } });
    if (!item) return; // stavka više ne postoji — orphan cleanup je posao rekonsilijacije, ne ovog puta
    const booking = await this.prisma.booking.findUnique({ where: { id: item.bookingId } });
    if (!booking) return;

    const data = await this.buildFactBookingData(item, booking, cache);
    await this.prisma.factBooking.upsert({
      where: { bookingItemId: item.id },
      create: data,
      update: data,
    });
  }

  /** Sinhronizuje SVE stavke jedne rezervacije — koristi ga event subscriber (booking.* događaji nose bookingId). */
  async syncBooking(bookingId: string): Promise<void> {
    const items = await this.prisma.bookingItem.findMany({ where: { bookingId } });
    for (const item of items) {
      await this.syncBookingItem(item.id);
    }
  }

  private async buildFactBookingData(
    item: BookingItem,
    booking: Booking,
    cache?: FactSyncCache,
  ): Promise<Prisma.FactBookingUncheckedCreateInput> {
    // Bez keša (`cache` je `undefined`) ponašanje je identično dosadašnjem — svaki poziv ide u
    // bazu. Sa kešom se ponovljeni isti podatak učita jednom po prolazu (dok. 39 nalaz 2.3).
    const load = <T>(space: string, key: string, fn: () => Promise<T>): Promise<T> =>
      cache ? cache.get(space, key, fn) : fn();

    const product = await load('product', item.productId, () => this.products.findOne(item.productId));
    const attrs = (product.attributes ?? {}) as { accommodation_type?: string; stars?: number };

    let roomType: string | null = null;
    let boardType: string | null = null;
    let supplierId: string | null = null;
    let supplierName: string | null = null;
    let providerCode: string | null = null;

    if (item.sourceType === 'CONTRACTED') {
      if (item.rateLineId) {
        const rateLine = await this.prisma.rateLine.findUnique({
          where: { id: item.rateLineId },
          include: { contractPeriod: true },
        });
        roomType = rateLine?.contractPeriod.roomType ?? null;
        boardType = rateLine?.boardType ?? null;
      }
      if (product.sourceContractId) {
        const contractId = product.sourceContractId;
        const contract = await load('contract', contractId, () => this.contracts.findOne(contractId));
        supplierId = contract.supplierId;
        const sid = supplierId;
        const supplier = await load('supplier', sid, () => this.suppliers.findOne(sid));
        supplierName = supplier.name;
      }
    } else {
      providerCode = product.sourceProvider ?? null;
    }

    const clientAccount = await load('clientAccount', booking.clientAccountId, () =>
      this.clientAccounts.findOne(booking.clientAccountId),
    );
    const subagent = await load('subagent', booking.clientAccountId, () =>
      this.subagents.findByClientAccountId(booking.clientAccountId),
    );
    const subagentName = subagent ? (clientAccount.companyName ?? clientAccount.fullName ?? null) : null;

    const guestCount = await this.prisma.bookingItemGuest.count({ where: { bookingItemId: item.id } });
    const nights = Math.round((item.stayTo.getTime() - item.stayFrom.getTime()) / MS_PER_DAY);

    const referral = booking.referralTrackingCode
      ? await load('referral', booking.referralTrackingCode, () => this.resolveContentAttribution(booking.referralTrackingCode))
      : { contentId: null, contentName: null };

    return {
      bookingItemId: item.id,
      bookingId: booking.id,
      bookingDate: booking.confirmedAt ?? booking.createdAt,
      stayFrom: item.stayFrom,
      stayTo: item.stayTo,
      nights,
      guestCount,
      productId: item.productId,
      productType: product.type,
      accommodationType: product.type === 'ACCOMMODATION' ? (attrs.accommodation_type ?? null) : null,
      stars: product.type === 'ACCOMMODATION' ? (attrs.stars ?? null) : null,
      roomType,
      boardType,
      destinationCountry: product.destinationCountry,
      destinationCity: product.destinationCity,
      sourceType: item.sourceType,
      supplierId,
      providerCode,
      channel: booking.channel,
      clientAccountId: booking.clientAccountId,
      baseCost: item.baseCost,
      finalPrice: item.finalPrice,
      currency: item.finalPriceCurrency,
      margin: item.finalPrice - item.baseCost,
      productName: product.translation?.name ?? '(bez naziva)',
      supplierName,
      subagentName,
      referralContentId: referral.contentId,
      referralContentName: referral.contentName,
      status: item.itemStatus,
      lastSyncedAt: new Date(),
    };
  }

  // M13 spec §4.3 — razrešava Booking.referral_tracking_code protiv M12 ContentPiece.tracking_code.
  // M12 je sad implementiran (avgust 2026) — poziva se ContentService.findByTrackingCode preko
  // in-process DI (isti obrazac kao ostali cross-modul pozivi u ovom fajlu: M2/M3/M6/M7/M10).
  // Nepostojeći/null kod ostaje null, isto kao pre — sistem nikad ne izmišlja atribuciju (§3a).
  private async resolveContentAttribution(
    trackingCode: string | null,
  ): Promise<{ contentId: string | null; contentName: string | null }> {
    if (!trackingCode) return { contentId: null, contentName: null };
    const content = await this.content.findByTrackingCode(trackingCode);
    if (!content) return { contentId: null, contentName: null };
    return { contentId: content.id, contentName: content.name };
  }

  // ==========================================================================
  // FactPayment
  // ==========================================================================

  /** Sinhronizuje jedan M10 Payment (samo status=RECEIVED se projektuje — vidi M13 spec §3.2). */
  async syncPayment(paymentId: string, cache?: FactSyncCache): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'RECEIVED' || !payment.bookingId || !payment.receivedAt) {
      // Nije (više) primljena uplata — ako je ranije bila projektovana, ukloni je (npr. VOIDED
      // posle inicijalnog RECEIVED, retko ali moguće kod kartičnih storniranja).
      await this.prisma.factPayment.deleteMany({ where: { paymentId } });
      return;
    }

    // Kurs je isti za sve uplate iste valute istog dana — u prolazu sa hiljadu uplata to je bio
    // isti upit hiljadu puta (dok. 39 nalaz 2.3).
    const rateKey = `${payment.currency}|${payment.receivedAt.toISOString().slice(0, 10)}`;
    const amountRsdPerUnit = cache
      ? await cache.get('rate', rateKey, () => this.rateToRsd(payment.currency, payment.receivedAt!))
      : await this.rateToRsd(payment.currency, payment.receivedAt);
    const amountRsd = amountRsdPerUnit === null ? null : Math.round(payment.amount * amountRsdPerUnit);
    if (amountRsd === null) return; // nema kursa za taj datum — rekonsilijacija će ponoviti sledeće noći

    const data: Prisma.FactPaymentUncheckedCreateInput = {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      amountRsd,
      method: payment.method,
      receivedAt: payment.receivedAt,
    };
    await this.prisma.factPayment.upsert({ where: { paymentId: payment.id }, create: data, update: data });
  }

  /** Kurs za jednu valutu na jedan dan — izdvojeno da se može keširati po (valuta, dan), ne po uplati. */
  private async rateToRsd(currency: string, onDate: Date): Promise<number | null> {
    if (currency === 'RSD') return 1;
    try {
      const snapshot = await this.exchangeRates.findForCurrencyOnOrBefore(currency, onDate);
      return Number(snapshot.nbsMiddleRate);
    } catch {
      this.logger.warn(`Nema kursa za ${currency} na dan ${onDate.toISOString().slice(0, 10)} ili ranije — FactPayment sinhronizacija odložena za sledeću rekonsilijaciju.`);
      return null;
    }
  }

  // ==========================================================================
  // Puna rekonstrukcija (izlazni kriterijum — brisanje + rebuild daje identičan rezultat)
  // ==========================================================================

  /** Briše CELU projekciju i ponovo je gradi iz izvora (M2/M3/M5/M6/M7/M10) — M13 spec §1.1/§8. */
  async rebuildAll(): Promise<{ factBookings: number; factPayments: number }> {
    await this.prisma.factBooking.deleteMany({});
    await this.prisma.factPayment.deleteMany({});

    const items = await this.prisma.bookingItem.findMany({ select: { id: true } });
    for (const item of items) {
      await this.syncBookingItem(item.id);
    }

    const receivedPayments = await this.payments.findAll({});
    for (const payment of receivedPayments.filter((p) => p.status === 'RECEIVED')) {
      await this.syncPayment(payment.id);
    }

    const factBookings = await this.prisma.factBooking.count();
    const factPayments = await this.prisma.factPayment.count();
    return { factBookings, factPayments };
  }
}
