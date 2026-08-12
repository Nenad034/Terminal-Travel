import { M10AlarmsService } from './m10-alarms.service';

describe('M10AlarmsService (M10 spec §6.2/§8.2)', () => {
  function makeService() {
    const eventBus = { emit: jest.fn() };
    const fiscalDocuments = { findStaleDrafts: jest.fn() };
    const supplierObligations = { findDueSoon: jest.fn() };
    const clientPaymentSchedules = { checkOverdueAndEscalate: jest.fn() };
    const reconciliation = { checkAndEmitSignals: jest.fn() };
    const service = new M10AlarmsService(
      eventBus as any,
      fiscalDocuments as any,
      supplierObligations as any,
      clientPaymentSchedules as any,
      reconciliation as any,
    );
    return { service, eventBus, fiscalDocuments, supplierObligations };
  }

  it('emituje fiscal_document_draft_stale za svaki DRAFT stariji od 24h', async () => {
    const { service, eventBus, fiscalDocuments } = makeService();
    fiscalDocuments.findStaleDrafts.mockResolvedValue([{ id: 'fd-1', bookingId: 'booking-1' }]);

    await service.checkStaleFiscalDrafts();

    expect(eventBus.emit).toHaveBeenCalledWith('M10', 'fiscal_document_draft_stale', { fiscalDocumentId: 'fd-1', bookingId: 'booking-1' });
  });

  it('emituje supplier_obligation_due_soon za svaku obavezu pred rokom', async () => {
    const { service, eventBus, supplierObligations } = makeService();
    supplierObligations.findDueSoon.mockResolvedValue([{ id: 'so-1', dueDate: new Date('2026-08-20') }]);

    await service.checkSupplierObligationsDueSoon();

    expect(eventBus.emit).toHaveBeenCalledWith('M10', 'supplier_obligation_due_soon', { supplierObligationId: 'so-1', dueDate: new Date('2026-08-20') });
  });
});
