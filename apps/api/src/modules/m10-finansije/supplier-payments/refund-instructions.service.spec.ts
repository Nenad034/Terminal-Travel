import { BadRequestException } from '@nestjs/common';
import { RefundInstructionsService } from './refund-instructions.service';

describe('RefundInstructionsService (M10 spec §8.5.3)', () => {
  function makeService() {
    const prisma: any = {
      refundInstruction: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      payment: { findUnique: jest.fn() },
    };
    const auditLog = { write: jest.fn() };
    const service = new RefundInstructionsService(prisma, auditLog as any);
    return { service, prisma, auditLog };
  }

  it('odbija EXECUTE bez prethodnog APPROVED — pokušaj preskakanja koraka', async () => {
    const { service, prisma } = makeService();
    prisma.refundInstruction.findUnique.mockResolvedValue({ id: 'ri-1', status: 'PENDING' });

    await expect(service.execute('ri-1', { userId: 'actor-1' })).rejects.toThrow(BadRequestException);
  });

  it('redosled APPROVE pa EXECUTE prolazi', async () => {
    const { service, prisma } = makeService();
    const instruction = { id: 'ri-1', status: 'PENDING' };
    prisma.refundInstruction.findUnique.mockResolvedValueOnce(instruction).mockResolvedValueOnce({ ...instruction, status: 'APPROVED' });
    prisma.refundInstruction.update
      .mockResolvedValueOnce({ ...instruction, status: 'APPROVED', approvedBy: 'actor-1' })
      .mockResolvedValueOnce({ ...instruction, status: 'EXECUTED', approvedBy: 'actor-1', executedBy: 'actor-1' });

    const approved = await service.approve('ri-1', { userId: 'actor-1' });
    expect(approved.status).toBe('APPROVED');

    const executed = await service.execute('ri-1', { userId: 'actor-1' });
    expect(executed.status).toBe('EXECUTED');
  });
});
