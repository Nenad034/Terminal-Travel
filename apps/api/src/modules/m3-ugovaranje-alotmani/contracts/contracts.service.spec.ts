import { BadRequestException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

describe('ContractsService (M3 spec §2.2/§2.2a)', () => {
  function makeService() {
    const prisma = { contract: { findMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const auditLog = { write: jest.fn() };
    const service = new ContractsService(prisma as any, auditLog as any);
    return { service, prisma, auditLog };
  }

  describe('create', () => {
    it('kreira ugovor kao DRAFT bez obzira da li je defaultTipNastupanja poslat', async () => {
      const { service, prisma } = makeService();
      prisma.contract.create.mockResolvedValue({ id: 'c1', status: 'DRAFT' });

      await service.create(
        {
          supplierId: 's1',
          contractNumber: 'UG-1',
          currency: 'EUR' as any,
          validFrom: '2027-01-01',
          validTo: '2027-12-31',
          cancellationTermsSummary: 'test',
          documentUrl: 'https://example.com/doc.pdf',
        },
        'actor-1',
      );

      expect(prisma.contract.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT' }) }),
      );
    });
  });

  describe('update — default_tip_nastupanja gejt pre ACTIVE (§2.2)', () => {
    it('odbija prelaz u ACTIVE bez defaultTipNastupanja (ni na ugovoru ni u zahtevu)', async () => {
      const { service, prisma } = makeService();
      prisma.contract.findUniqueOrThrow.mockResolvedValue({ id: 'c1', status: 'DRAFT', defaultTipNastupanja: null });

      await expect(service.update('c1', { status: 'ACTIVE' as any }, 'actor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.contract.update).not.toHaveBeenCalled();
    });

    it('dozvoljava prelaz u ACTIVE kad je defaultTipNastupanja već postavljen na ugovoru', async () => {
      const { service, prisma } = makeService();
      prisma.contract.findUniqueOrThrow.mockResolvedValue({
        id: 'c1',
        status: 'DRAFT',
        defaultTipNastupanja: 'ORGANIZATOR',
      });
      prisma.contract.update.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });

      const result = await service.update('c1', { status: 'ACTIVE' as any }, 'actor-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('dozvoljava prelaz u ACTIVE kad se defaultTipNastupanja postavlja u istom zahtevu', async () => {
      const { service, prisma } = makeService();
      prisma.contract.findUniqueOrThrow.mockResolvedValue({ id: 'c1', status: 'DRAFT', defaultTipNastupanja: null });
      prisma.contract.update.mockResolvedValue({ id: 'c1', status: 'ACTIVE', defaultTipNastupanja: 'POSREDNIK' });

      const result = await service.update(
        'c1',
        { status: 'ACTIVE' as any, defaultTipNastupanja: 'POSREDNIK' as any },
        'actor-1',
      );
      expect(result.status).toBe('ACTIVE');
    });

    it('ne proverava gejt kad ugovor ostaje van ACTIVE (npr. izmena teksta uslova)', async () => {
      const { service, prisma } = makeService();
      prisma.contract.findUniqueOrThrow.mockResolvedValue({ id: 'c1', status: 'DRAFT', defaultTipNastupanja: null });
      prisma.contract.update.mockResolvedValue({ id: 'c1', status: 'DRAFT' });

      await expect(service.update('c1', { cancellationTermsSummary: 'novo' }, 'actor-1')).resolves.toBeDefined();
    });

    it('ne proverava gejt kad je ugovor već ACTIVE (samo se menja nešto drugo)', async () => {
      const { service, prisma } = makeService();
      prisma.contract.findUniqueOrThrow.mockResolvedValue({ id: 'c1', status: 'ACTIVE', defaultTipNastupanja: 'ORGANIZATOR' });
      prisma.contract.update.mockResolvedValue({ id: 'c1', status: 'ACTIVE' });

      await expect(service.update('c1', { status: 'ACTIVE' as any }, 'actor-1')).resolves.toBeDefined();
    });
  });
});
