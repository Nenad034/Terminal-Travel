import { Injectable } from '@nestjs/common';
import { CronExpression, Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { HealthSignalsService } from '../health-signals/health-signals.service';

const WINDOW_HOURS = 24;

// M18 spec §2.1 — pragovi "neuobičajenog skoka" su konstante ovde, ne izmišljeni jednom pa
// zaboravljeni brojevi razbacani u kodu; spec §11 eksplicitno kaže da se tačan prag "podešava
// empirijski kad sistem počne da radi u produkciji" — vrednosti ispod su svesni, konzervativni
// polazni pragovi za prvi prolaz, ne konačna odluka.
const PROVIDER_ERROR_WARNING = 5;
const PROVIDER_ERROR_CRITICAL = 15;
const PAYMENT_FAILURE_WARNING = 3;
const PAYMENT_FAILURE_CRITICAL = 10;
const AUTH_FAILED_WARNING_PER_ACTOR = 5;
const AUTH_FAILED_CRITICAL_PER_ACTOR = 10;

// M18 spec §2.1 — dnevni skener nad izvorima koji (za razliku od M3/M10, poglavlje događaj-
// pretplate) još ne emituju sopstvene Event Bus signale: M4 ProviderCallLog (agregatna učestalost
// grešaka, DRUGAČIJE od per-provajder ProviderHealthService — ovo je agregatni okidač preko svih
// provajdera zajedno, spec §2.3 napomena), M10 Payment (FAILED/VOIDED učestalost), M11
// TravelGuaranteeRegistration (spec pominje "GuestRegistration" — taj model ne postoji, stvaran
// M11 model je TravelGuaranteeRegistration, ispravljeno pri implementaciji), M9 FieldIncidentNote
// (URGENT), M1 AuditLogEntry (neuobičajen obrazac neuspelih prijava). Isti @Cron obrazac kao
// M10AlarmsService/M11AlarmsService (EVERY_DAY_AT_6AM), isti hibridni "direktan Prisma read"
// obrazac kao FactSyncService (M13) za modele bez sopstvenog read-servisa.
@Injectable()
export class HealthDetectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthSignals: HealthSignalsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyChecks(): Promise<void> {
    await Promise.all([
      this.checkProviderErrorSpike(),
      this.checkPaymentFailureSpike(),
      this.checkGuestRegistrationFailures(),
      this.checkUrgentFieldIncidents(),
      this.checkAuthAnomalies(),
    ]);
  }

  private since(): Date {
    return new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  }

  async checkProviderErrorSpike(): Promise<void> {
    const since = this.since();
    const errors = await this.prisma.providerCallLog.groupBy({
      by: ['providerCode'],
      where: { timestamp: { gte: since }, errorCode: { not: null } },
      _count: { _all: true },
    });

    for (const row of errors) {
      const count = row._count._all;
      if (count < PROVIDER_ERROR_WARNING) continue;
      await this.healthSignals.create({
        sourceModule: 'M4',
        signalType: 'PROVIDER_ERROR_SPIKE',
        severity: count >= PROVIDER_ERROR_CRITICAL ? 'CRITICAL' : 'WARNING',
        details: { providerCode: row.providerCode, errorCount: count, windowHours: WINDOW_HOURS },
      });
    }
  }

  async checkPaymentFailureSpike(): Promise<void> {
    const since = this.since();
    const count = await this.prisma.payment.count({
      where: { status: { in: ['FAILED', 'VOIDED'] }, createdAt: { gte: since } },
    });
    if (count < PAYMENT_FAILURE_WARNING) return;

    await this.healthSignals.create({
      sourceModule: 'M10',
      signalType: 'PAYMENT_FAILURE_SPIKE',
      severity: count >= PAYMENT_FAILURE_CRITICAL ? 'CRITICAL' : 'WARNING',
      details: { failedOrVoidedCount: count, windowHours: WINDOW_HOURS },
    });
  }

  async checkGuestRegistrationFailures(): Promise<void> {
    const since = this.since();
    const failed = await this.prisma.travelGuaranteeRegistration.findMany({
      where: { status: 'FAILED', createdAt: { gte: since } },
      select: { id: true, bookingId: true, failureReason: true },
    });
    if (failed.length === 0) return;

    await this.healthSignals.create({
      sourceModule: 'M11',
      signalType: 'GUEST_REGISTRATION_FAILED',
      severity: 'WARNING',
      details: { count: failed.length, registrations: failed },
    });
  }

  async checkUrgentFieldIncidents(): Promise<void> {
    const since = this.since();
    const urgent = await this.prisma.fieldIncidentNote.findMany({
      where: { severity: 'URGENT', syncedAt: { gte: since } },
      select: { id: true, bookingId: true, guideId: true, note: true },
    });
    if (urgent.length === 0) return;

    await this.healthSignals.create({
      sourceModule: 'M9',
      signalType: 'FIELD_INCIDENT_URGENT',
      severity: 'CRITICAL',
      details: { count: urgent.length, incidents: urgent },
    });
  }

  async checkAuthAnomalies(): Promise<void> {
    const since = this.since();
    const failures = await this.prisma.auditLogEntry.groupBy({
      by: ['actorId'],
      where: { module: 'M1', action: 'auth.login_failed', timestamp: { gte: since }, actorId: { not: null } },
      _count: { _all: true },
    });

    for (const row of failures) {
      const count = row._count._all;
      if (count < AUTH_FAILED_WARNING_PER_ACTOR) continue;
      await this.healthSignals.create({
        sourceModule: 'M1',
        signalType: 'AUTH_ANOMALY',
        severity: count >= AUTH_FAILED_CRITICAL_PER_ACTOR ? 'CRITICAL' : 'WARNING',
        securityCategory: 'AUTH',
        details: { actorId: row.actorId, failedLoginCount: count, windowHours: WINDOW_HOURS },
      });
    }
  }
}
