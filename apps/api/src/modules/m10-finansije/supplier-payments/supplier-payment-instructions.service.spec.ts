import { BadRequestException } from '@nestjs/common';
import { SupplierPaymentInstructionsService } from './supplier-payment-instructions.service';

describe('SupplierPaymentInstructionsService (M10 spec §8.5.2)', () => {
  function makeService() {
    const prisma: any = {
      supplierPaymentInstruction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      supplierObligation: { findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new SupplierPaymentInstructionsService(prisma, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('odbija kreiranje instrukcije nad obavezom koja nije APPROVED', async () => {
    const { service, prisma } = makeService();
    prisma.supplierObligation.findUnique.mockResolvedValue({ id: 'so-1', status: 'PENDING' });

    await expect(
      service.create({ supplierObligationId: 'so-1', method: 'BANK_TRANSFER' } as any, { userId: 'actor-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('execute zahteva ljudski nalog i postavlja EXECUTED', async () => {
    const { service, prisma } = makeService();
    const instruction = { id: 'spi-1', status: 'PENDING' };
    prisma.supplierPaymentInstruction.findUnique.mockResolvedValue(instruction);
    prisma.supplierPaymentInstruction.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...instruction, ...data }),
    );

    const result = await service.execute('spi-1', { userId: 'actor-1' });

    expect(result.status).toBe('EXECUTED');
    expect(result.executedBy).toBe('actor-1');
  });

  it('odbija execute nad instrukcijom koja nije PENDING', async () => {
    const { service, prisma } = makeService();
    prisma.supplierPaymentInstruction.findUnique.mockResolvedValue({ id: 'spi-1', status: 'EXECUTED' });

    await expect(service.execute('spi-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
  });
});
