import { BadRequestException } from '@nestjs/common';
import { CommissionRebatesService } from './commission-rebates.service';

describe('CommissionRebatesService (M7 spec §3.2)', () => {
  function makeService() {
    const prisma: any = { commissionRebate: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const auditLog = { write: jest.fn() };
    const fiscalDocumentStub = { prepareCreditNoteDraftForRebate: jest.fn() };
    const service = new CommissionRebatesService(prisma, auditLog as any, fiscalDocumentStub as any);
    return { service, prisma, auditLog, fiscalDocumentStub };
  }

  describe('approve — DRAFT → APPROVED (ljudska odluka, ne APPLIED)', () => {
    it('postavlja status APPROVED, popunjava approvedBy/approvedAt, NE popunjava appliedAt', async () => {
      const { service, prisma, auditLog, fiscalDocumentStub } = makeService();
      const rebate = { id: 'rebate-1', status: 'DRAFT', subagentId: 'sub-1', calculatedAmount: 2000, currency: 'EUR' };
      prisma.commissionRebate.findUnique.mockResolvedValue(rebate);
      prisma.commissionRebate.update.mockImplementation(({ data }: any) => Promise.resolve({ ...rebate, ...data }));

      const result = await service.approve('rebate-1', { userId: 'staff-1' });

      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe('staff-1');
      expect(result.approvedAt).toBeInstanceOf(Date);
      expect(result.appliedAt).toBeUndefined();
      expect(auditLog.write).toHaveBeenCalledWith(
        expect.objectContaining({ actorType: 'HUMAN', actorId: 'staff-1', action: 'commission_rebate.approved' }),
      );
    });

    it('poziva FiscalDocumentStubService.prepareCreditNoteDraftForRebate sa ažuriranim rabatom (M10 spec §5.1a)', async () => {
      const { service, prisma, fiscalDocumentStub } = makeService();
      const rebate = { id: 'rebate-1', status: 'DRAFT', subagentId: 'sub-1', calculatedAmount: 2000, currency: 'EUR' };
      prisma.commissionRebate.findUnique.mockResolvedValue(rebate);
      prisma.commissionRebate.update.mockImplementation(({ data }: any) => Promise.resolve({ ...rebate, ...data }));

      await service.approve('rebate-1', { userId: 'staff-1' });

      expect(fiscalDocumentStub.prepareCreditNoteDraftForRebate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rebate-1', status: 'APPROVED', subagentId: 'sub-1', calculatedAmount: 2000, currency: 'EUR' }),
      );
    });

    it('odbija approve nad rabatom koji nije u statusu DRAFT', async () => {
      const { service, prisma } = makeService();
      prisma.commissionRebate.findUnique.mockResolvedValue({ id: 'rebate-1', status: 'APPROVED' });

      await expect(service.approve('rebate-1', { userId: 'staff-1' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('markApplied — APPROVED → APPLIED (posledica stvarnog M10 knjiženja, ne AI/ljudska odluka)', () => {
    it('postavlja status APPLIED i appliedAt', async () => {
      const { service, prisma, auditLog } = makeService();
      const rebate = { id: 'rebate-1', status: 'APPROVED', approvedBy: 'staff-1' };
      prisma.commissionRebate.findUnique.mockResolvedValue(rebate);
      prisma.commissionRebate.update.mockImplementation(({ data }: any) => Promise.resolve({ ...rebate, ...data }));

      const result = await service.markApplied('rebate-1');

      expect(result.status).toBe('APPLIED');
      expect(result.appliedAt).toBeInstanceOf(Date);
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'SYSTEM', action: 'commission_rebate.applied' }));
    });

    it('odbija markApplied nad rabatom koji nije u statusu APPROVED', async () => {
      const { service, prisma } = makeService();
      prisma.commissionRebate.findUnique.mockResolvedValue({ id: 'rebate-1', status: 'DRAFT' });

      await expect(service.markApplied('rebate-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject (nepromenjeno)', () => {
    it('odbija DRAFT rabat sa razlogom', async () => {
      const { service, prisma, auditLog } = makeService();
      const rebate = { id: 'rebate-1', status: 'DRAFT' };
      prisma.commissionRebate.findUnique.mockResolvedValue(rebate);
      prisma.commissionRebate.update.mockImplementation(({ data }: any) => Promise.resolve({ ...rebate, ...data }));

      const result = await service.reject('rebate-1', 'ne primenjuje se', { userId: 'staff-1' });

      expect(result.status).toBe('REJECTED');
      expect(auditLog.write).toHaveBeenCalledWith(expect.objectContaining({ context: { reason: 'ne primenjuje se' } }));
    });
  });
});
