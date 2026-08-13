import { Injectable } from '@nestjs/common';
import { FactBooking, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type PeriodFilter = { from?: string; to?: string };

export interface Bucket {
  key: string;
  count: number;
  revenue: number;
  margin: number;
}

export interface DynamicNode {
  key: string;
  count: number;
  pax: number;
  nights: number;
  revenue: number;
  paid: number;
  balance: number;
  children: DynamicNode[];
}

export const DYNAMIC_DIMENSIONS = [
  'destination_country',
  'destination_city',
  'product_name',
  'supplier_name',
  'channel',
  'subagent_name',
] as const;
export type DynamicDimension = (typeof DYNAMIC_DIMENSIONS)[number];

export const OCCUPANCY_GROUP_BY = ['room_type', 'board_type', 'stars', 'accommodation_type'] as const;
export type OccupancyGroupBy = (typeof OCCUPANCY_GROUP_BY)[number];

// M13 spec §4 — svi izveštaji čitaju isključivo FactBooking/FactPayment (projekcija), nikad
// direktno druge module (§1.1). Svaki izveštaj vraća last_synced_at (§2) — "korisnik zna koliko
// su podaci sveži".
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================================================
  // §4 — Profitabilnost po destinaciji/dobavljaču/kanalu
  // ==========================================================================
  async profitability(
    filters: PeriodFilter & { destinationCountry?: string; destinationCity?: string; supplierId?: string; providerCode?: string; channel?: string },
  ) {
    const where: Prisma.FactBookingWhereInput = {
      ...this.periodWhere(filters),
      destinationCountry: filters.destinationCountry,
      destinationCity: filters.destinationCity,
      supplierId: filters.supplierId,
      providerCode: filters.providerCode,
      channel: filters.channel,
    };
    const rows = await this.prisma.factBooking.findMany({ where });

    return {
      byDestination: this.bucketize(rows, (r) => `${r.destinationCountry} / ${r.destinationCity}`),
      bySupplier: this.bucketize(rows, (r) => r.supplierName ?? r.providerCode ?? '(nepoznat dobavljač/provajder)'),
      byChannel: this.bucketize(rows, (r) => r.channel),
      lastSyncedAt: await this.lastSyncedAt(rows),
    };
  }

  // ==========================================================================
  // §4 — Prodaja (broj rezervacija, ukupna/prosečna vrednost, po kanalu/tipu proizvoda)
  // Napomena: "broj rezervacija" ovde znači broj FactBooking redova (M5 BookingItem stavki) —
  // isti nivo agregacije kao ostali M13 izveštaji (npr. §4.1 "Prodate sobe"), pošto FactBooking
  // namerno ne nosi ništa što bi omogućilo grupisanje na nivo cele M5 Booking bez dodatnog joina.
  // ==========================================================================
  async sales(filters: PeriodFilter & { channel?: string; productType?: string }) {
    const where: Prisma.FactBookingWhereInput = {
      ...this.periodWhere(filters),
      channel: filters.channel,
      productType: filters.productType as never,
    };
    const rows = await this.prisma.factBooking.findMany({ where });
    const totalValue = rows.reduce((sum, r) => sum + r.finalPrice, 0);

    return {
      bookingCount: rows.length,
      totalValue,
      averageValue: rows.length > 0 ? Math.round(totalValue / rows.length) : 0,
      byChannel: this.bucketize(rows, (r) => r.channel),
      byProductType: this.bucketize(rows, (r) => r.productType),
      lastSyncedAt: await this.lastSyncedAt(rows),
    };
  }

  // ==========================================================================
  // §4.1 — Operativna statistika smeštaja
  // ==========================================================================
  async occupancy(
    filters: PeriodFilter & { destinationCountry?: string; destinationCity?: string; supplierId?: string; groupBy?: OccupancyGroupBy },
  ) {
    const where: Prisma.FactBookingWhereInput = {
      ...this.periodWhere(filters),
      destinationCountry: filters.destinationCountry,
      destinationCity: filters.destinationCity,
      supplierId: filters.supplierId,
    };
    const rows = await this.prisma.factBooking.findMany({ where });

    const guestCount = rows.reduce((sum, r) => sum + r.guestCount, 0);
    const nights = rows.reduce((sum, r) => sum + r.guestCount * r.nights, 0);
    const accommodationRows = rows.filter((r) => r.productType === 'ACCOMMODATION');
    const soldUnitsTotal = accommodationRows.length;

    let breakdown: (Bucket & { nights: number })[] | null = null;
    let unclassifiedCount = 0;
    if (filters.groupBy) {
      const dimField = this.occupancyDimField(filters.groupBy);
      const classified = accommodationRows.filter((r) => (r[dimField] as unknown) != null);
      unclassifiedCount = accommodationRows.length - classified.length;
      breakdown = this.bucketizeWithNights(classified, (r) => String(r[dimField]));
    }

    return {
      guestCount,
      nights,
      soldUnitsTotal,
      groupBy: filters.groupBy ?? null,
      breakdown,
      unclassifiedCount,
      lastSyncedAt: await this.lastSyncedAt(rows),
    };
  }

  private occupancyDimField(groupBy: OccupancyGroupBy): keyof FactBooking {
    switch (groupBy) {
      case 'room_type':
        return 'roomType';
      case 'board_type':
        return 'boardType';
      case 'stars':
        return 'stars';
      case 'accommodation_type':
        return 'accommodationType';
    }
  }

  // ==========================================================================
  // §4.2 — Dinamički drill-down izveštaj (korisnički sastavljiv redosled dimenzija)
  // ==========================================================================
  async dynamic(filters: PeriodFilter, dimensions: DynamicDimension[]) {
    const rows = await this.prisma.factBooking.findMany({ where: this.periodWhere(filters) });
    const payments = await this.prisma.factPayment.findMany();
    const paidByBookingId = new Map<string, number>();
    for (const p of payments) {
      paidByBookingId.set(p.bookingId, (paidByBookingId.get(p.bookingId) ?? 0) + p.amountRsd);
    }

    const tree = this.buildDynamicTree(rows, dimensions, paidByBookingId);
    return { dimensions, tree, lastSyncedAt: await this.lastSyncedAt(rows) };
  }

  private buildDynamicTree(rows: FactBooking[], dims: DynamicDimension[], paidByBookingId: Map<string, number>): DynamicNode[] {
    if (dims.length === 0) return [];
    const [dim, ...rest] = dims;
    const keyFn = this.dynamicKeyFn(dim);

    const groups = new Map<string, FactBooking[]>();
    for (const r of rows) {
      const key = keyFn(r);
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }

    return [...groups.entries()]
      .map(([key, groupRows]) => {
        const count = groupRows.length;
        const pax = groupRows.reduce((s, r) => s + r.guestCount, 0);
        const nights = groupRows.reduce((s, r) => s + r.guestCount * r.nights, 0);
        const revenue = groupRows.reduce((s, r) => s + r.finalPrice, 0);
        const bookingIds = new Set(groupRows.map((r) => r.bookingId));
        const paid = [...bookingIds].reduce((s, id) => s + (paidByBookingId.get(id) ?? 0), 0);
        return {
          key,
          count,
          pax,
          nights,
          revenue,
          paid,
          balance: revenue - paid,
          children: this.buildDynamicTree(groupRows, rest, paidByBookingId),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  private dynamicKeyFn(dim: DynamicDimension): (r: FactBooking) => string {
    switch (dim) {
      case 'destination_country':
        return (r) => r.destinationCountry;
      case 'destination_city':
        return (r) => r.destinationCity;
      case 'product_name':
        return (r) => r.productName;
      case 'supplier_name':
        return (r) => r.supplierName ?? r.providerCode ?? '(nepoznat dobavljač/provajder)';
      case 'channel':
        return (r) => r.channel;
      case 'subagent_name':
        return (r) => r.subagentName ?? 'Direktna prodaja';
    }
  }

  // ==========================================================================
  // §4.3 — Marketing performanse (atribucija ka M12 sadržaju)
  // ==========================================================================
  async marketing(filters: PeriodFilter) {
    const rows = await this.prisma.factBooking.findMany({ where: this.periodWhere(filters) });
    const attributed = rows.filter((r) => r.referralContentId !== null);
    const unattributed = rows.filter((r) => r.referralContentId === null);

    const byContent = this.bucketize(attributed, (r) => r.referralContentName ?? r.referralContentId!);

    return {
      byContent,
      withoutKnownOrigin: { count: unattributed.length, revenue: unattributed.reduce((s, r) => s + r.finalPrice, 0) },
      attributedShare: rows.length > 0 ? attributed.length / rows.length : 0,
      lastSyncedAt: await this.lastSyncedAt(rows),
    };
  }

  // ==========================================================================
  // Zajedničke pomoćne funkcije
  // ==========================================================================
  private periodWhere(filters: PeriodFilter): Prisma.FactBookingWhereInput {
    // §4.1 — "aktivne stavke (status != CANCELLED)", primenjeno na sve izveštaje (poglavlje 4).
    const where: Prisma.FactBookingWhereInput = { status: { not: 'CANCELLED' } };
    if (filters.from) where.stayTo = { gte: new Date(filters.from) };
    if (filters.to) where.stayFrom = { lte: new Date(filters.to) };
    return where;
  }

  private bucketize(rows: FactBooking[], keyFn: (r: FactBooking) => string): Bucket[] {
    const map = new Map<string, Bucket>();
    for (const r of rows) {
      const key = keyFn(r);
      const bucket = map.get(key) ?? { key, count: 0, revenue: 0, margin: 0 };
      bucket.count += 1;
      bucket.revenue += r.finalPrice;
      bucket.margin += r.margin;
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }

  private bucketizeWithNights(rows: FactBooking[], keyFn: (r: FactBooking) => string): (Bucket & { nights: number })[] {
    const map = new Map<string, Bucket & { nights: number }>();
    for (const r of rows) {
      const key = keyFn(r);
      const bucket = map.get(key) ?? { key, count: 0, revenue: 0, margin: 0, nights: 0 };
      bucket.count += 1;
      bucket.revenue += r.finalPrice;
      bucket.margin += r.margin;
      bucket.nights += r.guestCount * r.nights;
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }

  // §2 — "svaki izveštaj prikazuje poslednje_ažurirano vreme". Najsvežije last_synced_at unutar
  // filtriranog skupa; ako je skup prazan, pada nazad na najsvežije u celoj projekciji (da UI ne
  // prikaže "nikad" iako je projekcija sveža, samo trenutni filter nema rezultata).
  private async lastSyncedAt(rows: FactBooking[]): Promise<Date | null> {
    if (rows.length > 0) {
      return rows.reduce((max, r) => (r.lastSyncedAt > max ? r.lastSyncedAt : max), rows[0].lastSyncedAt);
    }
    const latest = await this.prisma.factBooking.findFirst({ orderBy: { lastSyncedAt: 'desc' } });
    return latest?.lastSyncedAt ?? null;
  }
}
