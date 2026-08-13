import { FiscalDocumentStubService } from './fiscal-document-stub.service';

describe('FiscalDocumentStubService (M7 → M10, M10 spec §5.1a)', () => {
  function makeService() {
    const prisma: any = { subagent: { findUnique: jest.fn() } };
    const fiscalDocuments = { prepareCreditNoteDraft: jest.fn() };
    const clientAccounts = { findOne: jest.fn() };
    const service = new FiscalDocumentStubService(prisma, fiscalDocuments as any, clientAccounts as any);
    return { service, prisma, fiscalDocuments, clientAccounts };
  }

  it('poziva prepareCreditNoteDraft sa amount/currency/subagentId/rebateId i stvarnim nazivom firme iz M6', async () => {
    const { service, prisma, fiscalDocuments, clientAccounts } = makeService();
    prisma.subagent.findUnique.mockResolvedValue({ id: 'sub-1', clientAccountId: 'acc-1' });
    clientAccounts.findOne.mockResolvedValue({ id: 'acc-1', companyName: 'M7 Test Turagencija', fullName: null });

    const rebate = { id: 'rebate-1', subagentId: 'sub-1', calculatedAmount: 2000, currency: 'EUR' } as any;
    await service.prepareCreditNoteDraftForRebate(rebate);

    expect(fiscalDocuments.prepareCreditNoteDraft).toHaveBeenCalledWith({
      relatedSubagentId: 'sub-1',
      creditedRebateId: 'rebate-1',
      amount: 2000,
      currency: 'EUR',
      buyerNameSnapshot: 'M7 Test Turagencija',
    });
  });

  it('koristi fullName kao fallback kad companyName nije postavljen', async () => {
    const { service, prisma, fiscalDocuments, clientAccounts } = makeService();
    prisma.subagent.findUnique.mockResolvedValue({ id: 'sub-1', clientAccountId: 'acc-1' });
    clientAccounts.findOne.mockResolvedValue({ id: 'acc-1', companyName: null, fullName: 'Petar Petrović' });

    await service.prepareCreditNoteDraftForRebate({ id: 'rebate-1', subagentId: 'sub-1', calculatedAmount: 1000, currency: 'EUR' } as any);

    expect(fiscalDocuments.prepareCreditNoteDraft).toHaveBeenCalledWith(expect.objectContaining({ buyerNameSnapshot: 'Petar Petrović' }));
  });

  it('ne baca grešku i preskače pripremu nacrta kad Subagent zapis (weak reference) ne postoji', async () => {
    const { service, prisma, fiscalDocuments } = makeService();
    prisma.subagent.findUnique.mockResolvedValue(null);

    await service.prepareCreditNoteDraftForRebate({ id: 'rebate-1', subagentId: 'missing', calculatedAmount: 1000, currency: 'EUR' } as any);

    expect(fiscalDocuments.prepareCreditNoteDraft).not.toHaveBeenCalled();
  });

  it('koristi prazan string kad M6 ClientAccount ne postoji/upit ne uspe', async () => {
    const { service, prisma, fiscalDocuments, clientAccounts } = makeService();
    prisma.subagent.findUnique.mockResolvedValue({ id: 'sub-1', clientAccountId: 'acc-missing' });
    clientAccounts.findOne.mockRejectedValue(new Error('nije pronađen'));

    await service.prepareCreditNoteDraftForRebate({ id: 'rebate-1', subagentId: 'sub-1', calculatedAmount: 1000, currency: 'EUR' } as any);

    expect(fiscalDocuments.prepareCreditNoteDraft).toHaveBeenCalledWith(expect.objectContaining({ buyerNameSnapshot: '' }));
  });
});
