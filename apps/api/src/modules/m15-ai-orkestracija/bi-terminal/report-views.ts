import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReportsService, DYNAMIC_DIMENSIONS, type DynamicDimension } from '../../m13-bi/reports/reports.service';
import { SupplierObligationsService } from '../../m10-finansije/supplier-obligations/supplier-obligations.service';
import { SearchService } from '../../m5-rezervacije/search/search.service';

// M15 spec §6.9.6 — generički read-only upit nad ZATVORENIM registrom "pogleda". Ovo NIJE slobodan
// SQL/Prisma upit od jezičkog modela: model bira isključivo `view` iz VIEW_NAMES i, po pogledu,
// dozvoljene `groupBy`/`filters` ključeve iz ovog fajla — svaki pogled je unapred pregledan kod koji
// poziva POSTOJEĆE servise (isti "defense in depth" princip kao §6.9.1, samo širi domet od fiksne
// liste alata §6.9.3). Dodavanje novog pogleda je izmena ovog fajla + dokumenta, nikad odluka agenta.
export const VIEW_NAMES = ['bookings', 'employee_sales', 'subagent_performance', 'supplier_obligations', 'catalog_offers'] as const;
export type ViewName = (typeof VIEW_NAMES)[number];

export interface QueryViewArgs {
  metric?: string;
  groupBy?: string;
  dateFrom?: string;
  dateTo?: string;
  filters?: Record<string, unknown>;
}

@Injectable()
export class ReportViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly supplierObligations: SupplierObligationsService,
    private readonly search: SearchService,
  ) {}

  async query(view: string, args: QueryViewArgs): Promise<unknown> {
    switch (view as ViewName) {
      case 'bookings':
        return this.bookingsView(args);
      case 'employee_sales':
        return this.employeeSalesView(args);
      case 'subagent_performance':
        return this.reports.dynamic({ from: args.dateFrom, to: args.dateTo }, ['subagent_name']);
      case 'supplier_obligations':
        return this.supplierObligationsView(args);
      case 'catalog_offers':
        return this.catalogOffersView(args);
      default:
        return { error: `Nepoznat pogled: "${view}". Dozvoljeni pogledi: ${VIEW_NAMES.join(', ')}.` };
    }
  }

  // `bookings` — bez groupBy vraća ukupne brojeve (isto kao report_snapshot, ali proizvoljan
  // period bez ograničenja), sa groupBy koristi već postojeći M13 "dinamički izveštaj" (§4.2.1
  // te specifikacije) koji ume da grupiše po bilo kojoj od DYNAMIC_DIMENSIONS.
  private async bookingsView(args: QueryViewArgs) {
    const filters = args.filters ?? {};
    if (args.groupBy === 'status') {
      // `status` namerno NIJE deo M13 DYNAMIC_DIMENSIONS (taj registar je pisan za §4.2.1
      // "dinamički izveštaj" pre nego što je BiTerminalAgent postojao) — lokalna dopuna ovde,
      // uživo otkrivena praznina (23.8.2026, "kojeg su statusa te rezervacije" nije imalo odgovor).
      const where: { bookingDate?: { gte?: Date; lte?: Date } } = {};
      if (args.dateFrom || args.dateTo) {
        where.bookingDate = {};
        if (args.dateFrom) where.bookingDate.gte = new Date(args.dateFrom);
        if (args.dateTo) where.bookingDate.lte = new Date(args.dateTo);
      }
      const rows = await this.prisma.factBooking.findMany({ where, select: { status: true, finalPrice: true } });
      const byStatus = new Map<string, { bookingCount: number; totalValue: number }>();
      for (const r of rows) {
        const acc = byStatus.get(r.status) ?? { bookingCount: 0, totalValue: 0 };
        acc.bookingCount += 1;
        acc.totalValue += r.finalPrice;
        byStatus.set(r.status, acc);
      }
      return [...byStatus.entries()].map(([status, acc]) => ({ status, ...acc }));
    }
    if (args.groupBy) {
      if (!DYNAMIC_DIMENSIONS.includes(args.groupBy as DynamicDimension)) {
        return { error: `Nepoznata dimenzija za grupisanje: "${args.groupBy}". Dozvoljene: status, ${DYNAMIC_DIMENSIONS.join(', ')}.` };
      }
      return this.reports.dynamic({ from: args.dateFrom, to: args.dateTo }, [args.groupBy as DynamicDimension]);
    }
    return this.reports.sales({
      from: args.dateFrom,
      to: args.dateTo,
      channel: typeof filters.channel === 'string' ? filters.channel : undefined,
      productType: typeof filters.productType === 'string' ? filters.productType : undefined,
    });
  }

  // `employee_sales` — dopuna (23.8.2026, na zahtev vlasnika — "ko od zaposlenih ima najbolju
  // prodaju u zadnjih sat vremena"). M13 FactBooking projekcija nema atribuciju ka zaposlenom koji
  // je uneo rezervaciju — samo M5 `Booking.created_by` to zna, pa se ovaj pogled čita direktno
  // odatle (izuzetak od "čitaj samo FactBooking" konvencije §1.1 M13 spec, opravdan jer M13
  // projekcija taj podatak namerno nikad nije uključivala — nije propust, samo druga granica
  // podataka). `created_by = 'GOST_SELF'` (samouslužni kanal) se izuzima — nije zaposleni.
  private async employeeSalesView(args: QueryViewArgs) {
    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (args.dateFrom || args.dateTo) {
      where.createdAt = {};
      if (args.dateFrom) where.createdAt.gte = new Date(args.dateFrom);
      if (args.dateTo) where.createdAt.lte = new Date(args.dateTo);
    }
    const bookings = await this.prisma.booking.findMany({
      where,
      select: { createdBy: true, totalPrice: true, status: true },
    });

    const byUser = new Map<string, { bookingCount: number; totalValue: number }>();
    for (const b of bookings) {
      if (b.createdBy === 'GOST_SELF') continue;
      const acc = byUser.get(b.createdBy) ?? { bookingCount: 0, totalValue: 0 };
      acc.bookingCount += 1;
      acc.totalValue += b.totalPrice;
      byUser.set(b.createdBy, acc);
    }
    if (byUser.size === 0) return [];

    const users = await this.prisma.user.findMany({ where: { id: { in: [...byUser.keys()] } }, select: { id: true, fullName: true } });
    const nameById = new Map(users.map((u) => [u.id, u.fullName]));
    return [...byUser.entries()]
      .map(([userId, acc]) => ({ employee: nameById.get(userId) ?? userId, ...acc }))
      .sort((a, b) => b.totalValue - a.totalValue);
  }

  // `supplier_obligations` — isti podaci kao stari fiksni `unpaid_arrangements` alat (§6.9.3), ali
  // sa opcionim `status` filterom umesto uvek PENDING+APPROVED. Bez filtera ponaša se identično
  // starom alatu, radi kompatibilnosti.
  private async supplierObligationsView(args: QueryViewArgs) {
    const filters = args.filters ?? {};
    const status = typeof filters.status === 'string' ? filters.status : undefined;
    if (status) return this.supplierObligations.findAll({ status });
    const pending = await this.supplierObligations.findAll({ status: 'PENDING' });
    const approved = await this.supplierObligations.findAll({ status: 'APPROVED' });
    return [...pending, ...approved];
  }

  // `catalog_offers` — dopuna (23.8.2026, na zahtev vlasnika — "pronađi najpovoljniju ponudu u
  // Budvi za dve odrasle osobe u junu 2027"). Poziva POSTOJEĆI M5 `SearchService.search` (isti kod
  // koji koristi GET /search za goste/subagente, §3.0b M5 spec) sa `channel: 'INTERNAL_PANEL'` —
  // nikad novi upit ka katalogu. Vraća najjeftiniju ponudu po proizvodu, sortirano rastuće po ceni,
  // ograničeno na 10 rezultata (isti "ne zatrpavaj odgovor" princip kao subagentBookings ≤10).
  private async catalogOffersView(args: QueryViewArgs) {
    const filters = args.filters ?? {};
    const destinationCity = typeof filters.destinationCity === 'string' ? filters.destinationCity : undefined;
    const destinationCountry = typeof filters.destinationCountry === 'string' ? filters.destinationCountry : undefined;
    const adults = typeof filters.adults === 'number' ? filters.adults : 2;
    const children = typeof filters.children === 'number' ? filters.children : 0;

    const products = await this.search.search({
      destinationCity,
      destinationCountry,
      stayFrom: args.dateFrom,
      stayTo: args.dateTo,
      occupancy: { adults, children },
      channel: 'INTERNAL_PANEL',
    });

    const cheapestPerProduct = products
      .map((p) => {
        const available = p.offers.filter((o) => o.availabilityStatus !== 'SOLD_OUT');
        if (available.length === 0) return null;
        const cheapest = available.reduce((min, o) => (o.finalPrice < min.finalPrice ? o : min));
        return {
          productId: p.productId,
          name: p.name,
          destinationCountry: p.destinationCountry,
          destinationCity: p.destinationCity,
          price: cheapest.finalPrice,
          currency: cheapest.finalPriceCurrency,
          boardType: cheapest.boardType,
          availabilityStatus: cheapest.availabilityStatus,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.price - b.price);

    return cheapestPerProduct.slice(0, 10);
  }
}
