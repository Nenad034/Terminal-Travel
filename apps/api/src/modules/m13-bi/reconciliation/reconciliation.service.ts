import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { FactSyncService } from '../sync/fact-sync.service';
import { FactSyncCache } from '../sync/fact-sync-cache';

export interface ReconciliationResult {
  bookingsChecked: number;
  bookingsCorrected: number;
  bookingsRemoved: number;
  paymentsChecked: number;
  paymentsRemoved: number;
  ranAt: Date;
}

// M13 spec §2 — "noćni posao rekonsilijacije koja povlači stanje direktno preko API-ja izvornih
// modula ... i upoređuje sa projekcijom M13, ispravljajući odstupanja". FactSyncService.syncBookingItem
// je već idempotentan upsert (poredi implicitno preko upsert-a) — ovde se dodaje eksplicitno brojanje
// šta je ZAISTA izmenjeno (za e2e proveru izlaznog kriterijuma "gubitak pojedinačnog događaja se
// ispravlja narednom noćnom rekonsilijacijom") i čišćenje projektovanih redova čiji izvor u M5/M10
// više ne postoji ili više ne kvalifikuje (npr. RECEIVED uplata koja je posle storno postala VOIDED).
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly factSync: FactSyncService,
  ) {}

  // Vreme namerno van radnog vremena tima (M14 alarmi koriste 6h, M13 rekonsilijacija ide
  // pre toga da izveštaji budu sveži kad tim počne dan).
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runNightly(): Promise<void> {
    await this.reconcile();
  }

  /**
   * Veličina serije (5.9.2026, dok. 39 nalaz 2.3). Do tada je posao učitavao SVE stavke odjednom
   * i za svaku radio zaseban upit — sa 10.000 stavki to je jedan ogroman rezultat u memoriji i
   * desetine hiljada upita. Sada se ide u serijama: po seriji jedan upit za stanje pre i jedan
   * za stanje posle, umesto po dva za svaku stavku.
   */
  private static readonly BATCH_SIZE = 500;

  async reconcile(): Promise<ReconciliationResult> {
    const ranAt = new Date();
    // Jedan keš za CEO prolaz — proizvod/ugovor/dobavljač/klijent se ponavljaju kroz hiljade
    // stavki; bez njega je isti podatak povlačen iznova za svaku (v. `FactSyncCache`).
    const cache = new FactSyncCache();

    let bookingsChecked = 0;
    let bookingsCorrected = 0;
    let cursor: string | undefined;

    // Kretanje kroz stavke „kursorom" po `id`, ne `skip`-om: `skip` na velikoj tabeli tera bazu
    // da prebroji i preskoči sve prethodne redove pri svakoj seriji, pa posao usporava što dalje
    // odmiče. Uz to je otporno na to da neko u međuvremenu doda ili obriše stavku.
    for (;;) {
      const batch = await this.prisma.bookingItem.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: ReconciliationService.BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      cursor = batch[batch.length - 1].id;
      bookingsChecked += batch.length;

      const ids = batch.map((i) => i.id);
      // JEDAN upit za celu seriju umesto jednog po stavci (ranije: `findUnique` u petlji).
      const beforeRows = await this.prisma.factBooking.findMany({ where: { bookingItemId: { in: ids } } });
      const before = new Map(beforeRows.map((f) => [f.bookingItemId, f]));

      for (const id of ids) {
        await this.factSync.syncBookingItem(id, cache);
      }

      const afterRows = await this.prisma.factBooking.findMany({ where: { bookingItemId: { in: ids } } });
      const after = new Map(afterRows.map((f) => [f.bookingItemId, f]));

      for (const id of ids) {
        const b = before.get(id);
        if (!b || this.factBookingChanged(b, after.get(id) ?? null)) bookingsCorrected++;
      }
    }

    // Orphan cleanup — FactBooking redovi čiji izvorni BookingItem više ne postoji u M5.
    // Jedan upit u bazi umesto dovlačenja SVIH id-jeva sa obe strane u memoriju radi poređenja
    // (dok. 39 nalaz 2.3 — isti razlog kao serije iznad).
    const bookingsRemoved = await this.prisma.$executeRaw`
      DELETE FROM fact_bookings f
      WHERE NOT EXISTS (SELECT 1 FROM booking_items bi WHERE bi.id = f.booking_item_id)
    `;

    // FactPayment — resinhronizuj sve trenutno postojeće uplate; `syncPayment` sam briše
    // projektovani red kad uplata više nije RECEIVED.
    let paymentsChecked = 0;
    let paymentCursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.payment.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: ReconciliationService.BATCH_SIZE,
        ...(paymentCursor ? { cursor: { id: paymentCursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      paymentCursor = batch[batch.length - 1].id;
      paymentsChecked += batch.length;
      for (const p of batch) {
        await this.factSync.syncPayment(p.id, cache);
      }
    }

    // Uklanja projektovane uplate čiji izvor više ne postoji ILI više nije RECEIVED. Ranije se
    // ovaj broj samo RAČUNAO (u memoriji), a redovi su ostajali dok ih `syncPayment` ne obriše
    // pojedinačno — što nije pokrivalo uplatu koja je u međuvremenu potpuno obrisana.
    const paymentsRemoved = await this.prisma.$executeRaw`
      DELETE FROM fact_payments f
      WHERE NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = f.payment_id AND p.status = 'RECEIVED')
    `;

    const result: ReconciliationResult = {
      bookingsChecked,
      bookingsCorrected,
      bookingsRemoved,
      paymentsChecked,
      paymentsRemoved,
      ranAt,
    };
    this.logger.log(
      `Rekonsilijacija završena: ${bookingsCorrected}/${bookingsChecked} FactBooking redova ispravljeno, ${bookingsRemoved} uklonjeno; FactPayment ${paymentsChecked} provereno, ${paymentsRemoved} uklonjeno (keširano ${cache.size()} pomoćnih zapisa).`,
    );
    return result;
  }

  private factBookingChanged(
    before: Record<string, unknown>,
    after: Record<string, unknown> | null,
  ): boolean {
    if (!after) return true;
    const ignore = new Set(['lastSyncedAt', 'id']);
    for (const key of Object.keys(after)) {
      if (ignore.has(key)) continue;
      if (String(before[key]) !== String(after[key])) return true;
    }
    return false;
  }
}
