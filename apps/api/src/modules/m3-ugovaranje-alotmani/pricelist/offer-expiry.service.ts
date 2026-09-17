import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OfferExpiryNotice,
  OfferExpirySourceType,
  OfferExpiryThreshold,
  OfferKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../m1-core-identitet/audit-log/audit-log.service';
import { EventBusService } from '../../../common/events/event-bus.service';
import { CapacityService, isoDay, startOfDay } from '../capacity/capacity.service';

const MS_DAY = 24 * 60 * 60 * 1000;
/** `CapacityService.grid` ograničava raspon na kvartal — duži period se čita u komadima. */
const GRID_CHUNK_DAYS = 92;

/** Naziv događaja na Event Bus-u (M3 §4.9.2/§4.9.3); pretplatnici: M12 §3d, M7 §5b. */
export const OFFER_EXPIRING_EVENT = 'pricelist.offer.expiring';

/**
 * M3 spec §4.9.3 — sve što primalac treba da bi napravio poruku BEZ čitanja M3 baze.
 * Datumi su ISO dan (`YYYY-MM-DD`); `booking_to` je efektivan istek, `stay_from/to` boravak —
 * odvojeno i imenovano, jer „još 7 dana" računato od boravka je laž u tekstu objave.
 */
export interface OfferExpiringEventPayload extends Record<string, unknown> {
  notice_id: string;
  source_type: OfferExpirySourceType;
  source_id: string;
  contract_id: string;
  contract_period_id: string | null;
  product_id: string | null;
  supplier_id: string;
  product_name: string | null;
  destination_country: string | null;
  destination_city: string | null;
  offer_kind: OfferKind;
  discount_summary: string;
  booking_to: string;
  days_left: number;
  stay_from: string | null;
  stay_to: string | null;
  has_subagent_allocations: boolean;
}

/** Jedna stavka iz §4.9.1 svedena na ono što posao gleda — bez obzira iz koje tabele dolazi. */
interface ExpiringCandidate {
  sourceType: OfferExpirySourceType;
  sourceId: string;
  contractId: string;
  supplierId: string;
  /** Periodi na koje se stavka odnosi (jedan za ponudu/cenu; više za popust sa dometom na sezonu/ugovor). */
  periods: PeriodLite[];
  offerKind: OfferKind;
  discountSummary: string;
  /** Efektivan istek kao UTC ponoć. */
  expiresOn: Date;
}

interface PeriodLite {
  id: string;
  contractId: string;
  roomType: string;
  allotmentMode: string;
  stayFrom: Date;
  stayTo: Date;
}

export interface OfferExpiryRunResult {
  scanned: number;
  emitted: { INTERNAL: number; MARKETING: number };
  /** `MARKETING` kandidati zaustavljeni na jednoj od tri ograde (§4.9.2) — sutra se gledaju ponovo. */
  withheld: number;
}

function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  return `${Number.isInteger(major) ? major : major.toFixed(2)} ${currency}`;
}

function formatPercent(value: Prisma.Decimal | number | string): string {
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} %`;
}

/**
 * M3 spec §4.9 — akcija pred istek: dva praga, dve publike.
 *
 * Šta radi dnevni posao: za svaku AKTIVNU stavku koja donosi nižu cenu i ima rok (§4.9.1)
 * računa koliko je dana ostalo i, ako je to ≤ pragu i za taj prag još nema zapisa, pravi
 * `OfferExpiryNotice`. `INTERNAL` (15 dana) je red u radnom spisku kapaciteta — ugovarač zove
 * hotel. `MARKETING` (7 dana) emituje `pricelist.offer.expiring` na koji se pretplaćuju M12
 * (nacrt objave, čovek odobrava) i M7 (subagenti) — M3 sam nikad ništa ne šalje (§4.9.4).
 *
 * „Manje ili jednako", ne „jednako": ako server jedan dan nije radio, obaveštenje ne sme da
 * propadne. Jedinstvenost (stavka, prag) je ono što ga sprečava da se ponovi.
 */
@Injectable()
export class OfferExpiryService {
  private readonly logger = new Logger(OfferExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBusService,
    private readonly capacity: CapacityService,
    private readonly config: ConfigService,
  ) {}

  /** §4.9.2 — pragovi su konfiguracija, ne brojevi u kodu (ekran za izmenu svesno ne postoji). */
  thresholdDays(threshold: OfferExpiryThreshold): number {
    const key =
      threshold === 'INTERNAL' ? 'M3_OFFER_EXPIRY_DAYS_INTERNAL' : 'M3_OFFER_EXPIRY_DAYS_MARKETING';
    const fallback = threshold === 'INTERNAL' ? 15 : 7;
    const raw = this.config.get<string>(key);
    const parsed = raw === undefined || raw === '' ? NaN : Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  // ── Dnevni posao ─────────────────────────────────────────────────────────

  async runDaily(today: Date = new Date()): Promise<OfferExpiryRunResult> {
    const day0 = startOfDay(today);
    const candidates = await this.collectCandidates();
    const result: OfferExpiryRunResult = {
      scanned: candidates.length,
      emitted: { INTERNAL: 0, MARKETING: 0 },
      withheld: 0,
    };

    for (const c of candidates) {
      const daysLeft = Math.floor((c.expiresOn.getTime() - day0.getTime()) / MS_DAY);
      // Istekla akcija se ne reklamira, ni interno ne javlja — nema šta da se produži pre roka.
      if (daysLeft < 0) continue;

      for (const threshold of ['INTERNAL', 'MARKETING'] as const) {
        if (daysLeft > this.thresholdDays(threshold)) continue;
        const exists = await this.prisma.offerExpiryNotice.findUnique({
          where: {
            sourceType_sourceId_threshold: {
              sourceType: c.sourceType,
              sourceId: c.sourceId,
              threshold,
            },
          },
          select: { id: true },
        });
        if (exists) continue;

        const product = await this.productForContract(c.contractId);
        if (threshold === 'MARKETING') {
          // Tri ograde (§4.9.2): reklamirati nešto što ne može da se proda je gore nego ne
          // reklamirati. Ograda 3 (ugašena/zamenjena stavka) je već u `collectCandidates`
          // (samo ACTIVE). Bez zapisa → sutra se gleda ponovo (kapacitet se može osloboditi).
          if (!product || product.status !== 'ACTIVE') {
            result.withheld++;
            continue;
          }
          if (!(await this.anyPeriodSellable(c.periods))) {
            result.withheld++;
            continue;
          }
        }

        const notice = await this.createNotice(c, threshold, daysLeft, product);
        if (!notice) continue; // paralelan posao je bio brži — jedinstvenost je odradila svoje
        result.emitted[threshold]++;

        if (threshold === 'MARKETING') {
          await this.eventBus.emit('M3', OFFER_EXPIRING_EVENT, this.toEventPayload(c, notice));
        }
      }
    }

    if (result.emitted.INTERNAL + result.emitted.MARKETING > 0 || result.withheld > 0) {
      this.logger.log(
        `Akcije pred istek: pregledano ${result.scanned}, interno ${result.emitted.INTERNAL}, marketing ${result.emitted.MARKETING}, zadržano ${result.withheld}.`,
      );
    }
    return result;
  }

  private async createNotice(
    c: ExpiringCandidate,
    threshold: OfferExpiryThreshold,
    daysLeft: number,
    product: ProductLite | null,
  ): Promise<OfferExpiryNotice | null> {
    const span = periodSpan(c.periods);
    try {
      const notice = await this.prisma.offerExpiryNotice.create({
        data: {
          sourceType: c.sourceType,
          sourceId: c.sourceId,
          threshold,
          daysLeftAtEmit: daysLeft,
          contractId: c.contractId,
          contractPeriodId: c.periods.length === 1 ? c.periods[0].id : null,
          productId: product?.id ?? null,
          productName: product?.name ?? null,
          destinationCountry: product?.destinationCountry ?? null,
          destinationCity: product?.destinationCity ?? null,
          offerKind: c.offerKind,
          discountSummary: c.discountSummary,
          bookingTo: c.expiresOn,
          stayFrom: span?.from ?? null,
          stayTo: span?.to ?? null,
        },
      });
      await this.auditLog.write({
        actorType: 'SYSTEM',
        module: 'M3',
        action: 'pricelist.offer_expiry_noticed',
        resourceType: 'OfferExpiryNotice',
        resourceId: notice.id,
        afterState: notice,
        context: { threshold, daysLeft, sourceType: c.sourceType, sourceId: c.sourceId },
      });
      return notice;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return null;
      throw err;
    }
  }

  private toEventPayload(c: ExpiringCandidate, n: OfferExpiryNotice): OfferExpiringEventPayload {
    return {
      notice_id: n.id,
      source_type: n.sourceType,
      source_id: n.sourceId,
      contract_id: n.contractId,
      contract_period_id: n.contractPeriodId,
      product_id: n.productId,
      supplier_id: c.supplierId,
      product_name: n.productName,
      destination_country: n.destinationCountry,
      destination_city: n.destinationCity,
      offer_kind: n.offerKind,
      discount_summary: n.discountSummary,
      booking_to: isoDay(n.bookingTo),
      days_left: n.daysLeftAtEmit,
      stay_from: n.stayFrom ? isoDay(n.stayFrom) : null,
      stay_to: n.stayTo ? isoDay(n.stayTo) : null,
      // M7 §5a `SubagentCapacityAllocation` je specifikacija bez tabele (17.9.2026) — dok ne
      // dobije kod, nijedan proizvod nema dodele, pa M7 §5b.1 podrazumeva `ALL_ACTIVE`.
      has_subagent_allocations: false,
    };
  }

  // ── Kandidati (§4.9.1) ───────────────────────────────────────────────────

  private async collectCandidates(): Promise<ExpiringCandidate[]> {
    const [offers, discounts, rateLines] = await Promise.all([
      this.offerCandidates(),
      this.discountCandidates(),
      this.firstTrancheCandidates(),
    ]);
    return [...offers, ...discounts, ...rateLines];
  }

  /** `PricelistOffer` oba tipa — efektivan istek je `min(booking_to, deposit_deadline)`. */
  private async offerCandidates(): Promise<ExpiringCandidate[]> {
    const offers = await this.prisma.pricelistOffer.findMany({
      where: { status: 'ACTIVE', contractPeriod: { status: 'ACTIVE' } },
      include: { contractPeriod: { include: { contract: true } } },
    });
    return offers.map((o) => {
      const deadlines = [o.bookingTo, o.depositDeadline].filter((d): d is Date => d !== null);
      const expiresOn = startOfDay(new Date(Math.min(...deadlines.map((d) => d.getTime()))));
      const currency = o.contractPeriod.contract.currency;
      let discountSummary: string;
      if (o.offerType === 'FREE_NIGHTS') {
        discountSummary = `${o.stayNights ?? '?'}=${o.payNights ?? '?'}`;
      } else if (o.discountType === 'FIXED_AMOUNT' && o.discountAmount !== null) {
        discountSummary = `−${formatMoney(o.discountAmount, currency)}`;
      } else if (o.discountPercentage !== null) {
        discountSummary = `−${formatPercent(o.discountPercentage)}`;
      } else {
        discountSummary = 'rani buking';
      }
      return {
        sourceType: 'PRICELIST_OFFER' as const,
        sourceId: o.id,
        contractId: o.contractPeriod.contractId,
        supplierId: o.contractPeriod.contract.supplierId,
        periods: [o.contractPeriod],
        offerKind: o.offerType === 'FREE_NIGHTS' ? 'FREE_NIGHTS' : 'EARLY_BOOKING',
        discountSummary,
        expiresOn,
      };
    });
  }

  /** `AncillaryService` sa `kind = DISCOUNT` i rokom (§2.11e); domet period → sezona → ugovor (§2.11k). */
  private async discountCandidates(): Promise<ExpiringCandidate[]> {
    const items = await this.prisma.ancillaryService.findMany({
      where: { status: 'ACTIVE', kind: 'DISCOUNT', bookingTo: { not: null } },
      include: {
        contract: { include: { periods: { where: { status: 'ACTIVE' } } } },
        contractPeriod: true,
      },
    });
    return items.map((a) => {
      let periods: PeriodLite[];
      if (a.contractPeriod)
        periods = a.contractPeriod.status === 'ACTIVE' ? [a.contractPeriod] : [];
      else if (a.seasonId) periods = a.contract.periods.filter((p) => p.seasonId === a.seasonId);
      else periods = a.contract.periods;
      if (a.appliesToRoomTypes.length > 0) {
        periods = periods.filter((p) => a.appliesToRoomTypes.includes(p.roomType));
      }
      const discountSummary =
        a.pricingMode === 'PERCENTAGE_OF_NIGHTLY_RATE' && a.percentageOfNightlyRate !== null
          ? `−${formatPercent(a.percentageOfNightlyRate)} (${a.name})`
          : a.flatAmount !== null
            ? `−${formatMoney(a.flatAmount, a.contract.currency)} (${a.name})`
            : a.name;
      return {
        sourceType: 'ANCILLARY_SERVICE' as const,
        sourceId: a.id,
        contractId: a.contractId,
        supplierId: a.contract.supplierId,
        periods,
        offerKind: 'DISCOUNT' as const,
        discountSummary,
        expiresOn: startOfDay(a.bookingTo as Date),
      };
    });
  }

  /**
   * „Cena prve tranše" (§4.9.1): `RateLine` sa `booking_to` je akcija SAMO ako za istu
   * kombinaciju postoji druga aktivna cena, viša, koja važi posle ovog roka (ili bez prozora).
   * Kombinacija uključuje i popunjenost i dane u nedelji — cena za dve osobe nije „skuplja
   * naslednica" cene za jednu, ni vikend cena radnog dana.
   */
  private async firstTrancheCandidates(): Promise<ExpiringCandidate[]> {
    const withDeadline = await this.prisma.rateLine.findMany({
      where: { status: 'ACTIVE', bookingTo: { not: null }, contractPeriod: { status: 'ACTIVE' } },
      include: { contractPeriod: { include: { contract: true } } },
    });
    if (withDeadline.length === 0) return [];
    const siblings = await this.prisma.rateLine.findMany({
      where: {
        status: 'ACTIVE',
        contractPeriodId: { in: [...new Set(withDeadline.map((r) => r.contractPeriodId))] },
      },
    });
    const sameCombo = (a: (typeof siblings)[number], b: (typeof siblings)[number]) =>
      a.contractPeriodId === b.contractPeriodId &&
      a.boardType === b.boardType &&
      a.occupancy === b.occupancy &&
      a.priceBasis === b.priceBasis &&
      a.validWeekdays.length === b.validWeekdays.length &&
      a.validWeekdays.every((d) => b.validWeekdays.includes(d));

    const out: ExpiringCandidate[] = [];
    for (const line of withDeadline) {
      const bookingTo = line.bookingTo as Date;
      const successor = siblings
        .filter(
          (s) =>
            s.id !== line.id &&
            sameCombo(s, line) &&
            s.price > line.price &&
            (s.bookingFrom === null || s.bookingFrom.getTime() > bookingTo.getTime()),
        )
        .sort((a, b) => a.price - b.price)[0];
      if (!successor) continue;
      const pct = Math.round((1 - line.price / successor.price) * 100);
      out.push({
        sourceType: 'RATE_LINE',
        sourceId: line.id,
        contractId: line.contractPeriod.contractId,
        supplierId: line.contractPeriod.contract.supplierId,
        periods: [line.contractPeriod],
        offerKind: 'FIRST_TRANCHE',
        discountSummary: `−${pct} % do roka (${formatMoney(line.price, line.contractPeriod.contract.currency)} → ${formatMoney(successor.price, line.contractPeriod.contract.currency)})`,
        expiresOn: startOfDay(bookingTo),
      });
    }
    return out;
  }

  // ── Ograde (§4.9.2) ──────────────────────────────────────────────────────

  private async productForContract(contractId: string): Promise<ProductLite | null> {
    const p = await this.prisma.product.findFirst({
      where: { sourceContractId: contractId },
      select: {
        id: true,
        status: true,
        destinationCountry: true,
        destinationCity: true,
        translations: { where: { languageCode: 'sr' }, select: { name: true }, take: 1 },
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      status: p.status,
      name: p.translations[0]?.name ?? null,
      destinationCountry: p.destinationCountry,
      destinationCity: p.destinationCity,
    };
  }

  /** Ograda 2: bar jedan dan sa `za_prodaju ≥ 1` (§2.8c) ili period `ON_REQUEST`. */
  private async anyPeriodSellable(periods: PeriodLite[]): Promise<boolean> {
    for (const p of periods) {
      if (p.allotmentMode === 'ON_REQUEST') return true;
      if (await this.periodHasSellableDay(p)) return true;
    }
    return false;
  }

  private async periodHasSellableDay(p: PeriodLite): Promise<boolean> {
    const today = startOfDay(new Date());
    let from = startOfDay(p.stayFrom) > today ? startOfDay(p.stayFrom) : today;
    const end = startOfDay(new Date(p.stayTo.getTime() - MS_DAY)); // poslednja noć
    while (from <= end) {
      const chunkTo = new Date(
        Math.min(end.getTime(), from.getTime() + (GRID_CHUNK_DAYS - 1) * MS_DAY),
      );
      const grid = await this.capacity.grid({
        from: isoDay(from),
        to: isoDay(chunkTo),
        contractId: p.contractId,
        roomType: p.roomType,
        includeDraftContracts: true,
      });
      const row = grid.rows.find((r) => r.contractPeriodId === p.id);
      if (row?.days.some((d) => d.zaProdaju >= 1)) return true;
      from = new Date(chunkTo.getTime() + MS_DAY);
    }
    return false;
  }

  // ── Lista i potvrda (§6) ─────────────────────────────────────────────────

  async list(query: { threshold?: OfferExpiryThreshold; acknowledged?: boolean }) {
    return this.prisma.offerExpiryNotice.findMany({
      where: {
        threshold: query.threshold,
        acknowledgedAt:
          query.acknowledged === undefined ? undefined : query.acknowledged ? { not: null } : null,
      },
      orderBy: [{ bookingTo: 'asc' }, { emittedAt: 'asc' }],
      take: 200,
    });
  }

  /** Ugovarač potvrđuje da je video — red nestaje iz radnog spiska. Idempotentno. */
  async acknowledge(id: string, actorId: string) {
    const notice = await this.prisma.offerExpiryNotice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Obaveštenje o akciji pred istek nije pronađeno');
    if (notice.acknowledgedAt) return notice;
    const updated = await this.prisma.offerExpiryNotice.update({
      where: { id },
      data: { acknowledgedBy: actorId, acknowledgedAt: new Date() },
    });
    await this.auditLog.write({
      actorType: 'HUMAN',
      actorId,
      module: 'M3',
      action: 'pricelist.offer_expiry_acknowledged',
      resourceType: 'OfferExpiryNotice',
      resourceId: id,
      beforeState: notice,
      afterState: updated,
    });
    return updated;
  }
}

interface ProductLite {
  id: string;
  status: string;
  name: string | null;
  destinationCountry: string | null;
  destinationCity: string | null;
}

function periodSpan(periods: PeriodLite[]): { from: Date; to: Date } | null {
  if (periods.length === 0) return null;
  return {
    from: new Date(Math.min(...periods.map((p) => p.stayFrom.getTime()))),
    to: new Date(Math.max(...periods.map((p) => p.stayTo.getTime()))),
  };
}
