import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HealthSignal } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { HealthSignalsService } from '../health-signals/health-signals.service';
import { NotificationDispatchService } from '../notification-channels/notification-dispatch.service';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// M18 spec §4/§4.1 — nedeljni sažetak, uvek generisan i poslat, čak i bez signala. Sažetak je
// deterministički (agregacija po tipu/ozbiljnosti) u ovom prolazu, NE poziva jezički model —
// namerno, ne samo zbog troška (poglavlje 6.1 tabela ovo i onako svrstava kao "kratka
// klasifikacija/sažimanje", LIGHT nivo), već zato što M18 spec §5/Master dokument princip #4
// ("AI agenti se uvode postepeno, tek kad je modul stabilan u produkciji") isključuje da M18,
// tek implementiran, dobije sopstvenog AI agenta za bilo šta pre nego što prođe taj prag.
@Injectable()
export class WeeklyReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthSignals: HealthSignalsService,
    private readonly dispatch: NotificationDispatchService,
  ) {}

  @Cron('0 8 * * 1') // svakog ponedeljka u 8h
  async scheduledRun(): Promise<void> {
    await this.run();
  }

  async run() {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - SEVEN_DAYS_MS);

    const signals = await this.healthSignals.findSince(periodStart);
    const summary = this.buildSummary(signals, periodStart, periodEnd);

    const review = await this.prisma.weeklyHealthReview.create({
      data: {
        periodStart,
        periodEnd,
        summary,
        signalsIncluded: signals.map((s) => ({ id: s.id, type: s.signalType, severity: s.severity })),
        status: 'GENERATED',
      },
    });

    await this.dispatch.dispatchText(summary);

    return this.prisma.weeklyHealthReview.update({ where: { id: review.id }, data: { status: 'SENT', sentAt: new Date() } });
  }

  async findAll() {
    return this.prisma.weeklyHealthReview.findMany({ orderBy: { periodStart: 'desc' } });
  }

  private buildSummary(signals: HealthSignal[], periodStart: Date, periodEnd: Date): string {
    const range = `${periodStart.toLocaleDateString('sr-RS')} – ${periodEnd.toLocaleDateString('sr-RS')}`;
    if (signals.length === 0) {
      return `Nedeljni pregled (${range}): nijedan signal nije zabeležen. Nadzor aktivno radi.`;
    }

    const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 };
    const byType = new Map<string, number>();
    for (const s of signals) {
      bySeverity[s.severity] += 1;
      byType.set(s.signalType, (byType.get(s.signalType) ?? 0) + 1);
    }

    const typeLines = [...byType.entries()].map(([type, count]) => `- ${type}: ${count}`).join('\n');
    return (
      `Nedeljni pregled (${range}): ${signals.length} signala ukupno ` +
      `(${bySeverity.CRITICAL} CRITICAL, ${bySeverity.WARNING} WARNING, ${bySeverity.INFO} INFO).\n${typeLines}`
    );
  }
}
