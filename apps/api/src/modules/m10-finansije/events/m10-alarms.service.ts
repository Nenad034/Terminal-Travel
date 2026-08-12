import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventBusService } from '../../../common/events/event-bus.service';
import { FiscalDocumentsService } from '../fiscal-documents/fiscal-documents.service';
import { SupplierObligationsService } from '../supplier-obligations/supplier-obligations.service';
import { ClientPaymentSchedulesService } from '../payment-terms/client-payment-schedules.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

// M10 spec §6.2, §8.2, §5.4.3, §5.3 — periodični, čisto informativni alarmi. Nivo "Autonomno"
// (Master dokument poglavlje 7) — nijedan od ovih poziva ne menja Booking/FiscalDocument/
// SupplierObligation stanje, samo emituje signale preko Event Bus-a (M18 još ne postoji kao
// model, isti obrazac kao M5 RemindersService/M3 low_capacity_critical).
@Injectable()
export class M10AlarmsService {
  private readonly logger = new Logger(M10AlarmsService.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly fiscalDocuments: FiscalDocumentsService,
    private readonly supplierObligations: SupplierObligationsService,
    private readonly clientPaymentSchedules: ClientPaymentSchedulesService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyChecks(): Promise<void> {
    await Promise.all([
      this.checkStaleFiscalDrafts(),
      this.checkSupplierObligationsDueSoon(),
      this.clientPaymentSchedules.checkOverdueAndEscalate(),
      this.reconciliation.checkAndEmitSignals(),
    ]);
  }

  // §6.2 — DRAFT fiskalni dokument stariji od 24h bez slanja.
  async checkStaleFiscalDrafts(): Promise<void> {
    const stale = await this.fiscalDocuments.findStaleDrafts();
    for (const document of stale) {
      await this.eventBus.emit('M10', 'fiscal_document_draft_stale', { fiscalDocumentId: document.id, bookingId: document.bookingId });
    }
  }

  // §8.2 — 5 dana pre due_date neplaćene obaveze prema dobavljaču.
  async checkSupplierObligationsDueSoon(): Promise<void> {
    const dueSoon = await this.supplierObligations.findDueSoon();
    for (const obligation of dueSoon) {
      await this.eventBus.emit('M10', 'supplier_obligation_due_soon', { supplierObligationId: obligation.id, dueDate: obligation.dueDate });
    }
  }
}
