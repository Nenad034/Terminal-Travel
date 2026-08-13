import { BadRequestException } from '@nestjs/common';
import { FiscalDocumentsService } from './fiscal-documents.service';

describe('FiscalDocumentsService (M10 spec §6)', () => {
  function makeService() {
    const prisma: any = {
      fiscalDocument: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      booking: { findUnique: jest.fn() },
      payment: { findMany: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const exchangeRates = { findForCurrencyOnOrBefore: jest.fn() };
    const gateway = { submitDocument: jest.fn() };
    const eventBus = { emit: jest.fn() };
    const service = new FiscalDocumentsService(prisma, auditLog as any, exchangeRates as any, gateway as any, eventBus as any);
    return { service, prisma, auditLog, exchangeRates, gateway, eventBus };
  }

  describe('prepareDraft (§2, §4.4, §6.0)', () => {
    it('bira SEF_EFAKTURA i MARZA za pravno lice/organizatora, konvertuje u RSD', async () => {
      const { service, prisma, exchangeRates } = makeService();
      prisma.fiscalDocument.findFirst.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        buyerType: 'PRAVNO_LICE',
        buyerName: 'Firma DOO',
        buyerTaxId: '123456789',
        tipNastupanja: 'ORGANIZATOR',
        totalPrice: 100000, // 1000 EUR u centima
        currency: 'EUR',
        items: [{ baseCost: 60000 }],
      });
      exchangeRates.findForCurrencyOnOrBefore.mockResolvedValue({ id: 'ex-1', nbsMiddleRate: 117 });
      prisma.fiscalDocument.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'fd-1', ...data }));

      const doc = await service.prepareDraft('booking-1');

      expect(doc.documentType).toBe('SEF_EFAKTURA');
      expect(doc.vatCalculationBasis).toBe('MARZA');
      // marža bruto = 100000 - 60000 = 40000; PDV u marži = 40000 * 20/120 = 6666.67 -> 6667
      expect(doc.vatAmount).toBe(6667);
      expect(doc.amountRsd).toBe(100000 * 117);
      expect(doc.buyerNameSnapshot).toBe('Firma DOO');
      expect(doc.buyerTaxIdSnapshot).toBe('123456789');
    });

    it('bira ESIR_RACUN za fizičko lice', async () => {
      const { service, prisma, exchangeRates } = makeService();
      prisma.fiscalDocument.findFirst.mockResolvedValue(null);
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-2',
        buyerType: 'FIZICKO_LICE',
        buyerName: 'Petar Petrović',
        buyerTaxId: null,
        tipNastupanja: 'POSREDNIK',
        totalPrice: 50000,
        currency: 'RSD',
        items: [{ baseCost: 30000 }],
      });
      prisma.fiscalDocument.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'fd-2', ...data }));

      const doc = await service.prepareDraft('booking-2');

      expect(doc.documentType).toBe('ESIR_RACUN');
      expect(doc.vatCalculationBasis).toBe('PROVIZIJA');
      expect(doc.amountRsd).toBe(50000); // RSD -> RSD, bez konverzije
      expect(exchangeRates.findForCurrencyOnOrBefore).not.toHaveBeenCalled();
    });

    it('vraća postojeći dokument umesto duplog nacrta (idempotentno)', async () => {
      const { service, prisma } = makeService();
      prisma.fiscalDocument.findFirst.mockResolvedValue({ id: 'fd-existing' });

      const doc = await service.prepareDraft('booking-3');

      expect(doc).toEqual({ id: 'fd-existing' });
      expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('submit (§6 korak 2 — Nikad autonomno)', () => {
    it('odbija slanje dokumenta koji nije u statusu DRAFT', async () => {
      const { service, prisma } = makeService();
      prisma.fiscalDocument.findUnique.mockResolvedValue({ id: 'fd-1', status: 'SUBMITTED' });

      await expect(service.submit('fd-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('šalje nacrt, postavlja SUBMITTED i buyer_acceptance_deadline (15 dana) za SEF_EFAKTURA', async () => {
      const { service, prisma, gateway, auditLog } = makeService();
      const draft = {
        id: 'fd-1',
        status: 'DRAFT',
        bookingId: null,
        documentType: 'SEF_EFAKTURA',
        amountOriginal: 100000,
        currencyOriginal: 'EUR',
        amountRsd: 11700000,
        vatAmount: 6667,
        exchangeRateSnapshotId: 'ex-1',
        buyerNameSnapshot: 'Firma DOO',
        buyerTaxIdSnapshot: '123456789',
      };
      prisma.fiscalDocument.findUnique.mockResolvedValue(draft);
      gateway.submitDocument.mockResolvedValue({ externalReference: 'SEF-123', xmlUrl: 'x.xml', pdfUrl: 'x.pdf' });
      prisma.fiscalDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...draft, ...data }));

      const result = await service.submit('fd-1', { userId: 'actor-1' });

      expect(result.status).toBe('SUBMITTED');
      expect(result.externalReference).toBe('SEF-123');
      expect(result.buyerAcceptanceStatus).toBe('PENDING');
      expect(result.buyerAcceptanceDeadline).toBeInstanceOf(Date);
      const daysDiff = (result.buyerAcceptanceDeadline!.getTime() - result.submittedAt!.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysDiff).toBeCloseTo(15, 5);
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'HUMAN', actorId: 'actor-1' }));
    });

    it('preračunava amount_rsd po kursu na dan uplate koja dovodi do pune naplate, ako se razlikuje od kursa na dan nacrta (§3)', async () => {
      const { service, prisma, gateway, exchangeRates } = makeService();
      const draft = {
        id: 'fd-1',
        status: 'DRAFT',
        bookingId: 'booking-1',
        documentType: 'SEF_EFAKTURA',
        amountOriginal: 100000,
        currencyOriginal: 'EUR',
        amountRsd: 11700000, // pripremljeno po kursu 117 na dan nacrta
        vatAmount: 6667,
        exchangeRateSnapshotId: 'ex-draft',
        buyerNameSnapshot: 'Firma DOO',
        buyerTaxIdSnapshot: '123456789',
      };
      prisma.fiscalDocument.findUnique.mockResolvedValue(draft);
      prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1', totalPrice: 100000, paymentStatus: 'PAID' });
      const paymentDate = new Date('2026-08-15T10:00:00Z');
      prisma.payment.findMany.mockResolvedValue([{ amount: 100000, status: 'RECEIVED', receivedAt: paymentDate }]);
      exchangeRates.findForCurrencyOnOrBefore.mockResolvedValue({ id: 'ex-payment', nbsMiddleRate: 118 });
      gateway.submitDocument.mockResolvedValue({ externalReference: 'SEF-123', xmlUrl: 'x.xml', pdfUrl: 'x.pdf' });
      prisma.fiscalDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...draft, ...data }));

      const result = await service.submit('fd-1', { userId: 'actor-1' });

      expect(exchangeRates.findForCurrencyOnOrBefore).toHaveBeenCalledWith('EUR', paymentDate);
      expect(result.amountRsd).toBe(100000 * 118);
      expect(result.exchangeRateSnapshotId).toBe('ex-payment');
    });

    it('emituje M10 credit_note.submitted kad je KNJIZNO_ODOBRENJE poslat (§5.1a — M7 rabat prelazi u APPLIED preko Event Bus-a)', async () => {
      const { service, prisma, gateway, eventBus } = makeService();
      const draft = {
        id: 'fd-credit-1',
        status: 'DRAFT',
        bookingId: null,
        documentType: 'KNJIZNO_ODOBRENJE',
        amountOriginal: 25000,
        currencyOriginal: 'RSD',
        amountRsd: 25000,
        vatAmount: 0,
        exchangeRateSnapshotId: null,
        buyerNameSnapshot: 'M7 Test Turagencija',
        buyerTaxIdSnapshot: null,
        relatedSubagentId: 'subagent-1',
        creditedRebateId: 'rebate-1',
      };
      prisma.fiscalDocument.findUnique.mockResolvedValue(draft);
      gateway.submitDocument.mockResolvedValue({ externalReference: 'SEF-CN-1', xmlUrl: 'cn.xml', pdfUrl: 'cn.pdf' });
      prisma.fiscalDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...draft, ...data }));

      await service.submit('fd-credit-1', { userId: 'actor-1' });

      expect(eventBus.emit).toHaveBeenCalledWith('M10', 'credit_note.submitted', { creditedRebateId: 'rebate-1', fiscalDocumentId: 'fd-credit-1' });
    });

    it('NE emituje credit_note.submitted za SEF_EFAKTURA/ESIR_RACUN (samo KNJIZNO_ODOBRENJE)', async () => {
      const { service, prisma, gateway, eventBus } = makeService();
      const draft = {
        id: 'fd-1',
        status: 'DRAFT',
        bookingId: null,
        documentType: 'ESIR_RACUN',
        amountOriginal: 50000,
        currencyOriginal: 'RSD',
        amountRsd: 50000,
        vatAmount: 8333,
        exchangeRateSnapshotId: null,
        buyerNameSnapshot: 'Petar Petrović',
        buyerTaxIdSnapshot: null,
      };
      prisma.fiscalDocument.findUnique.mockResolvedValue(draft);
      gateway.submitDocument.mockResolvedValue({ externalReference: 'ESIR-1', xmlUrl: null, pdfUrl: 'x.pdf' });
      prisma.fiscalDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...draft, ...data }));

      await service.submit('fd-1', { userId: 'actor-1' });

      expect(eventBus.emit).not.toHaveBeenCalled();
    });

    it('postavlja buyer_acceptance_status = N_A za ESIR_RACUN (nema koncept prihvatanja)', async () => {
      const { service, prisma, gateway } = makeService();
      const draft = {
        id: 'fd-2',
        status: 'DRAFT',
        bookingId: null,
        documentType: 'ESIR_RACUN',
        amountOriginal: 50000,
        currencyOriginal: 'RSD',
        amountRsd: 50000,
        vatAmount: 8333,
        exchangeRateSnapshotId: null,
        buyerNameSnapshot: 'Petar Petrović',
        buyerTaxIdSnapshot: null,
      };
      prisma.fiscalDocument.findUnique.mockResolvedValue(draft);
      gateway.submitDocument.mockResolvedValue({ externalReference: 'ESIR-1', xmlUrl: null, pdfUrl: 'x.pdf' });
      prisma.fiscalDocument.update.mockImplementation(({ data }: any) => Promise.resolve({ ...draft, ...data }));

      const result = await service.submit('fd-2', { userId: 'actor-1' });

      expect(result.buyerAcceptanceStatus).toBe('N_A');
      expect(result.buyerAcceptanceDeadline).toBeNull();
    });
  });

  describe('storno (§6.1)', () => {
    it('odbija storno nad nacrtom (DRAFT) koji nikad nije poslat', async () => {
      const { service, prisma } = makeService();
      prisma.fiscalDocument.findUnique.mockResolvedValue({ id: 'fd-1', status: 'DRAFT' });

      await expect(service.storno('fd-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
    });

    it('kreira nov dokument koji referencira original, ne menja original', async () => {
      const { service, prisma, gateway, auditLog } = makeService();
      const original = {
        id: 'fd-1',
        status: 'SUBMITTED',
        bookingId: 'booking-1',
        documentType: 'SEF_EFAKTURA',
        vatCalculationBasis: 'MARZA',
        amountOriginal: 100000,
        currencyOriginal: 'EUR',
        amountRsd: 11700000,
        vatRate: 20,
        vatAmount: 6667,
        exchangeRateSnapshotId: 'ex-1',
        buyerNameSnapshot: 'Firma DOO',
        buyerTaxIdSnapshot: '123456789',
      };
      prisma.fiscalDocument.findUnique.mockResolvedValue(original);
      gateway.submitDocument.mockResolvedValue({ externalReference: 'SEF-STORNO-1', xmlUrl: 'y.xml', pdfUrl: 'y.pdf' });
      prisma.fiscalDocument.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'fd-storno-1', ...data }));

      const storno = await service.storno('fd-1', { userId: 'actor-1' });

      expect(storno.status).toBe('STORNIRANO');
      expect(storno.stornoOfDocumentId).toBe('fd-1');
      expect(prisma.fiscalDocument.update).not.toHaveBeenCalled(); // original se ne menja
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: 'HUMAN', actorId: 'actor-1', action: 'fiscal_document.storno' }),
      );
    });
  });

  describe('prepareCreditNoteDraft (§5.1a)', () => {
    it('kreira KNJIZNO_ODOBRENJE nacrt bez booking_id, sa popunjenim related_subagent_id/credited_rebate_id', async () => {
      const { service, prisma } = makeService();
      prisma.fiscalDocument.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'fd-credit-1', ...data }));

      const doc = await service.prepareCreditNoteDraft({
        relatedSubagentId: 'subagent-1',
        creditedRebateId: 'rebate-1',
        amount: 25000,
        currency: 'RSD',
      });

      expect(doc.documentType).toBe('KNJIZNO_ODOBRENJE');
      expect(doc.bookingId).toBeNull();
      expect(doc.status).toBe('DRAFT');
      expect(doc.relatedSubagentId).toBe('subagent-1');
      expect(doc.creditedRebateId).toBe('rebate-1');
      expect(doc.amountRsd).toBe(25000); // RSD, bez konverzije
      expect(doc.buyerNameSnapshot).toBe(''); // nije prosleđeno — prazan string fallback
    });

    it('koristi prosleđen buyer_name_snapshot (M7 FiscalDocumentStubService, M10 spec §5.1a dopuna)', async () => {
      const { service, prisma } = makeService();
      prisma.fiscalDocument.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'fd-credit-2', ...data }));

      const doc = await service.prepareCreditNoteDraft({
        relatedSubagentId: 'subagent-1',
        creditedRebateId: 'rebate-1',
        amount: 25000,
        currency: 'RSD',
        buyerNameSnapshot: 'M7 Test Turagencija',
      });

      expect(doc.buyerNameSnapshot).toBe('M7 Test Turagencija');
    });
  });
});
