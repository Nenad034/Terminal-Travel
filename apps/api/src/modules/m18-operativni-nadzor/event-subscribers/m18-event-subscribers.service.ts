import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventListenerService } from '../../../common/events/event-listener.service';
import { HealthSignalsService } from '../health-signals/health-signals.service';
import { HealthSignalSeverity } from '@prisma/client';

// M18 spec §2.1 — M3 (contract-periods.service.ts §4.3), M10 payment_deadline_missed
// (client-payment-schedules.service.ts §5.4.3) i M10 reconciliation_mismatch
// (reconciliation.service.ts §5.3, koji je od ranije čekao M18 tačno ovim komentarom: "M18 još
// ne postoji kao model") već emituju tačno signale koje M18 treba preko Event Bus-a — pretplata
// ovde, bez ponovnog izračunavanja (isti princip kao ostali cross-modul pretplatnici, npr.
// M10EventSubscribersService na M5 booking.confirmed).
@Injectable()
export class M18EventSubscribersService implements OnModuleInit {
  constructor(
    private readonly eventListener: EventListenerService,
    private readonly healthSignals: HealthSignalsService,
  ) {}

  onModuleInit(): void {
    this.eventListener.on('M3', 'low_capacity_critical', async (payload) => {
      await this.healthSignals.create({
        sourceModule: 'M3',
        signalType: 'LOW_CAPACITY_CRITICAL',
        severity: (payload.severity as HealthSignalSeverity) ?? 'WARNING',
        details: payload,
      });
    });

    this.eventListener.on('M10', 'payment_deadline_missed', async (payload) => {
      await this.healthSignals.create({
        sourceModule: 'M10',
        signalType: 'PAYMENT_DEADLINE_MISSED',
        severity: (payload.severity as HealthSignalSeverity) ?? 'WARNING',
        details: payload,
      });
    });

    // §5.3 — čisto informativna neusklađenost (M10 spec), uvek WARNING (nema stepenovanje u
    // izvoru — ovo nije bezbednosni ni finansijski nepovratan problem, samo signal da pogleda).
    this.eventListener.on('M10', 'reconciliation_mismatch', async (payload) => {
      await this.healthSignals.create({
        sourceModule: 'M10',
        signalType: 'RECONCILIATION_MISMATCH',
        severity: 'WARNING',
        details: payload,
      });
    });
  }
}
