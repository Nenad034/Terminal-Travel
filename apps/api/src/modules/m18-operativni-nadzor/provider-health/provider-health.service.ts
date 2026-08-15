import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { HealthSignalsService } from '../health-signals/health-signals.service';

const WINDOW_MINUTES = 15;
// §11 — "prag za neuobičajen skok se podešava empirijski kad sistem počne da radi u
// produkciji" — isti princip primenjen ovde: konstante, ne magični brojevi razbacani u kodu,
// lako se menjaju kad se pokaže stvarna potreba.
const UNSTABLE_UPTIME_BELOW = 95; // % uspešnih poziva u prozoru
const OFFLINE_UPTIME_BELOW = 50;
const UNSTABLE_ERROR_COUNT_ABOVE = 3;

// M18 spec §2.3 — per-provajder infrastrukturne metrike, periodičan posao (svakih 15 min,
// isti prozor kao polje latency_ms_avg opis u spec tabeli). Prelazak u UNSTABLE/OFFLINE
// generiše PROVIDER_DEGRADED HealthSignal.
@Injectable()
export class ProviderHealthService {
  private readonly logger = new Logger(ProviderHealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthSignals: HealthSignalsService,
  ) {}

  @Cron('*/15 * * * *')
  async computeSnapshots(): Promise<void> {
    const providers = await this.prisma.providerConfig.findMany({ where: { status: 'ACTIVE' } });
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

    for (const provider of providers) {
      await this.computeForProvider(provider.providerCode, since);
    }
  }

  async computeForProvider(providerCode: string, since: Date) {
    const calls = await this.prisma.providerCallLog.findMany({
      where: { providerCode, timestamp: { gte: since } },
    });

    if (calls.length === 0) return null; // nema poziva u prozoru — nema šta da se izračuna

    const errorCount = calls.filter((c) => c.errorCode != null).length;
    const uptimePercentage = ((calls.length - errorCount) / calls.length) * 100;
    const latencyMsAvg = Math.round(calls.reduce((sum, c) => sum + c.latencyMs, 0) / calls.length);

    let status: 'ONLINE' | 'UNSTABLE' | 'OFFLINE' = 'ONLINE';
    if (uptimePercentage < OFFLINE_UPTIME_BELOW) status = 'OFFLINE';
    else if (uptimePercentage < UNSTABLE_UPTIME_BELOW || errorCount > UNSTABLE_ERROR_COUNT_ABOVE) status = 'UNSTABLE';

    const previous = await this.prisma.providerHealthSnapshot.findFirst({
      where: { providerCode },
      orderBy: { computedAt: 'desc' },
    });

    const snapshot = await this.prisma.providerHealthSnapshot.create({
      data: { providerCode, latencyMsAvg, uptimePercentage, errorCountLastHour: errorCount, status },
    });

    const wasHealthy = !previous || previous.status === 'ONLINE';
    if (status !== 'ONLINE' && wasHealthy) {
      await this.healthSignals.create({
        sourceModule: 'M4',
        signalType: 'PROVIDER_DEGRADED',
        severity: status === 'OFFLINE' ? 'CRITICAL' : 'WARNING',
        details: { providerCode, status, uptimePercentage, errorCountLastHour: errorCount, latencyMsAvg },
      });
    }

    return snapshot;
  }

  async findAll() {
    // Poslednji snapshot po provajderu — isti princip kao ostatak modula ("uvek trenutno stanje").
    const providers = await this.prisma.providerConfig.findMany();
    const snapshots = await Promise.all(
      providers.map((p) => this.prisma.providerHealthSnapshot.findFirst({ where: { providerCode: p.providerCode }, orderBy: { computedAt: 'desc' } })),
    );
    return snapshots.filter((s): s is NonNullable<typeof s> => s !== null);
  }
}
